import "dotenv/config";

import { config as loadEnv } from "dotenv";
import { Pool } from "pg";

const parsedEnv = loadEnv({ path: ".env" }).parsed ?? {};

type ForeignKey = {
  tableName: string;
  foreignTableName: string;
};

type TableColumn = {
  column_name: string;
  data_type: string;
};

function normalizePostgresConnectionString(connectionString: string) {
  const url = new URL(connectionString);

  if (url.searchParams.get("sslrootcert") === "system") {
    url.searchParams.delete("sslrootcert");
  }

  return url.toString();
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function parseArgs(argv: string[]) {
  return {
    reset: argv.includes("--reset"),
    batchSize: Number(
      argv
        .find((arg) => arg.startsWith("--batch-size="))
        ?.slice("--batch-size=".length) ?? 500,
    ),
  };
}

function requireUrl(name: string, value: string | undefined) {
  if (!value?.trim()) {
    throw new Error(`${name} is required.`);
  }

  return normalizePostgresConnectionString(value);
}

async function listTables(pool: Pool) {
  const result = await pool.query<{ table_name: string }>(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
    order by table_name
  `);

  return result.rows.map((row) => row.table_name);
}

async function listForeignKeys(pool: Pool) {
  const result = await pool.query<{
    table_name: string;
    foreign_table_name: string;
  }>(`
    select
      tc.table_name,
      ccu.table_name as foreign_table_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
      and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
      and ccu.table_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
  `);

  return result.rows.map((row) => ({
    tableName: row.table_name,
    foreignTableName: row.foreign_table_name,
  })) satisfies ForeignKey[];
}

function orderTables(
  tables: string[],
  foreignKeys: ForeignKey[],
  rowCounts = new Map<string, number>(),
) {
  const tableSet = new Set(tables);
  const dependencies = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();

  for (const table of tables) {
    dependencies.set(table, new Set());
    dependents.set(table, new Set());
  }

  for (const key of foreignKeys) {
    if (!tableSet.has(key.tableName) || !tableSet.has(key.foreignTableName)) {
      continue;
    }

    dependencies.get(key.tableName)?.add(key.foreignTableName);
    dependents.get(key.foreignTableName)?.add(key.tableName);
  }

  const sortReady = () =>
    ready.sort((left, right) => {
      const countDelta = (rowCounts.get(left) ?? 0) - (rowCounts.get(right) ?? 0);
      return countDelta === 0 ? left.localeCompare(right) : countDelta;
    });
  const ready = tables.filter((table) => dependencies.get(table)?.size === 0);
  sortReady();
  const ordered: string[] = [];

  while (ready.length > 0) {
    const table = ready.shift()!;
    ordered.push(table);

    for (const dependent of dependents.get(table) ?? []) {
      dependencies.get(dependent)?.delete(table);
      if (dependencies.get(dependent)?.size === 0) {
        ready.push(dependent);
        sortReady();
      }
    }
  }

  if (ordered.length !== tables.length) {
    const remaining = tables.filter((table) => !ordered.includes(table));
    return [...ordered, ...remaining.sort()];
  }

  return ordered;
}

async function listColumns(pool: Pool, tableName: string) {
  const result = await pool.query<TableColumn>(
    `
      select column_name, data_type
      from information_schema.columns
      where table_schema = 'public'
        and table_name = $1
      order by ordinal_position
    `,
    [tableName],
  );

  return result.rows;
}

async function countRows(pool: Pool, tableName: string) {
  const result = await pool.query<{ count: string }>(
    `select count(*)::text as count from ${quoteIdentifier(tableName)}`,
  );

  return Number(result.rows[0]?.count ?? 0);
}

async function resetTarget(pool: Pool, tables: string[]) {
  if (tables.length === 0) {
    return;
  }

  const tableList = tables.map(quoteIdentifier).join(", ");
  await pool.query(`truncate table ${tableList} restart identity cascade`);
}

function normalizeColumnValue(column: TableColumn, value: unknown) {
  if (
    (column.data_type === "json" || column.data_type === "jsonb") &&
    value !== null &&
    value !== undefined &&
    typeof value !== "string"
  ) {
    return JSON.stringify(value);
  }

  return value;
}

function buildInsertSql(tableName: string, columns: TableColumn[], rowCount: number) {
  const quotedColumns = columns.map((column) => quoteIdentifier(column.column_name)).join(", ");
  const values: string[] = [];
  let parameter = 1;

  for (let row = 0; row < rowCount; row += 1) {
    values.push(`(${columns.map(() => `$${parameter++}`).join(", ")})`);
  }

  return `insert into ${quoteIdentifier(tableName)} (${quotedColumns}) values ${values.join(", ")}`;
}

async function copyTable(
  source: Pool,
  target: Pool,
  tableName: string,
  batchSize: number,
) {
  const total = await countRows(source, tableName);
  const columns = await listColumns(source, tableName);

  if (total === 0 || columns.length === 0) {
    console.log(`${tableName}: ${total}`);
    return;
  }

  const safeBatchSize = Math.max(1, Math.min(batchSize, Math.floor(60_000 / columns.length)));
  let copied = 0;

  while (copied < total) {
    const rows = await source.query(
      `select * from ${quoteIdentifier(tableName)} order by ctid offset $1 limit $2`,
      [copied, safeBatchSize],
    );

    if (rows.rowCount === 0) {
      break;
    }

    const values = rows.rows.flatMap((row) =>
      columns.map((column) => normalizeColumnValue(column, row[column.column_name])),
    );
    await target.query(buildInsertSql(tableName, columns, rows.rowCount ?? 0), values);
    copied += rows.rowCount ?? 0;

    if (copied === total || copied % (safeBatchSize * 10) === 0) {
      console.log(`${tableName}: ${copied}/${total}`);
    }
  }
}

async function resetSequences(pool: Pool, tables: string[]) {
  for (const table of tables) {
    const result = await pool.query<{
      column_name: string;
      sequence_name: string | null;
    }>(
      `
        select
          column_name,
          pg_get_serial_sequence(format('%I.%I', table_schema, table_name), column_name) as sequence_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name = $1
      `,
      [table],
    );

    for (const row of result.rows) {
      if (!row.sequence_name) {
        continue;
      }

      await pool.query(
        `
          select setval(
            $1::regclass,
            greatest(coalesce((select max(${quoteIdentifier(row.column_name)}) from ${quoteIdentifier(table)}), 0), 1),
            true
          )
        `,
        [row.sequence_name],
      );
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sourceUrl = requireUrl(
    "SOURCE_DATABASE_URL or .env DATABASE_URL",
    process.env.SOURCE_DATABASE_URL ?? parsedEnv.DATABASE_URL,
  );
  const targetUrl = requireUrl("DATABASE_URL", process.env.DATABASE_URL);

  if (sourceUrl === targetUrl) {
    throw new Error("Source and target DATABASE_URL values are identical.");
  }

  const source = new Pool({ connectionString: sourceUrl });
  const target = new Pool({ connectionString: targetUrl });

  try {
    const tables = await listTables(source);
    const targetTables = new Set(await listTables(target));
    const copyableTables = tables.filter((table) => targetTables.has(table));
    const rowCounts = new Map<string, number>();
    for (const table of copyableTables) {
      rowCounts.set(table, await countRows(source, table));
    }
    const orderedTables = orderTables(copyableTables, await listForeignKeys(source), rowCounts);

    if (options.reset) {
      console.log(`Resetting ${copyableTables.length} target table(s).`);
      await resetTarget(target, copyableTables);
    }

    for (const table of orderedTables) {
      await copyTable(source, target, table, options.batchSize);
    }

    await resetSequences(target, orderedTables);
    console.log("Database copy complete.");
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
