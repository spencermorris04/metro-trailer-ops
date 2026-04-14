import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { eq } from "drizzle-orm";
import EmbeddedPostgres from "embedded-postgres";

const repoRoot = path.resolve(process.cwd());
const drizzleCli = path.join(repoRoot, "node_modules", "drizzle-kit", "bin.cjs");

async function bootstrapTestDatabase() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "metro-trailer-it-"));
  const port = 55432 + Math.floor(Math.random() * 1000);
  const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?schema=public`;

  const pg = new EmbeddedPostgres({
    databaseDir: path.join(tempDir, "pg"),
    user: "postgres",
    password: "postgres",
    port,
    persistent: false,
  });

  await pg.initialise();
  await pg.start();

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    METRO_TRAILER_RUNTIME_MODE: "demo",
    AUTH_SECRET: "inventory-lifecycle-test-secret",
    APP_URL: "http://localhost:3000",
  };

  const push = spawnSync(
    process.execPath,
    [drizzleCli, "push", "--config", "drizzle.config.ts", "--force"],
    {
      cwd: repoRoot,
      env,
      encoding: "utf8",
    },
  );

  assert.equal(
    push.status,
    0,
    `drizzle-kit push failed\nstdout:\n${push.stdout}\nstderr:\n${push.stderr}`,
  );

  process.env.DATABASE_URL = databaseUrl;
  process.env.METRO_TRAILER_RUNTIME_MODE = "demo";
  process.env.AUTH_SECRET = "inventory-lifecycle-test-secret";
  process.env.APP_URL = "http://localhost:3000";

  return {
    stop: async () => {
      const [{ pool }, { auditPool }] = await Promise.all([
        import("@/lib/db"),
        import("@/lib/server/audit-db"),
      ]);
      await pool.end();
      await auditPool.end();
      await pg.stop();
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

test("inventory lifecycle stays unified across transfer, contract, dispatch, inspection, maintenance, and rate adjustments", async (t) => {
  const harness = await bootstrapTestDatabase();
  t.after(async () => {
    await harness.stop();
  });

  const [{ db, schema }, platform] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/server/platform"),
  ]);

  const branchA = "branch_alpha";
  const branchB = "branch_beta";
  const customerId = "customer_alpha";
  const locationId = "location_alpha";
  const startDate = new Date("2026-04-01T00:00:00.000Z");
  const endDate = new Date("2026-05-01T00:00:00.000Z");

  await db.insert(schema.branches).values([
    {
      id: branchA,
      code: "ALP",
      name: "Alpha Branch",
      timezone: "America/New_York",
      address: {
        line1: "1 Alpha Way",
        city: "Atlanta",
        state: "GA",
        postalCode: "30301",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: branchB,
      code: "BET",
      name: "Beta Branch",
      timezone: "America/Chicago",
      address: {
        line1: "2 Beta Way",
        city: "Dallas",
        state: "TX",
        postalCode: "75001",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  await db.insert(schema.customers).values({
    id: customerId,
    customerNumber: "CUST-ALPHA",
    name: "Alpha Construction",
    customerType: "commercial",
    contactInfo: {
      name: "Casey Customer",
      email: "casey@example.com",
    },
    billingAddress: {
      line1: "100 Billing Rd",
      city: "Dallas",
      state: "TX",
      postalCode: "75001",
    },
    branchCoverage: [branchB],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.insert(schema.customerLocations).values({
    id: locationId,
    customerId,
    name: "Alpha Jobsite",
    address: {
      line1: "77 Jobsite Ln",
      city: "Plano",
      state: "TX",
      postalCode: "75024",
    },
    contactPerson: {
      name: "Jordan Foreman",
      phone: "555-0100",
    },
    isPrimary: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const createdAsset = await platform.createAsset({
    assetNumber: "TR-9001",
    type: "commercial_box_trailer",
    subtype: "48ft dry van",
    branchId: branchA,
    status: "available",
    dimensions: "48 x 102",
    serialNumber: "SN-9001",
    yardZone: "A",
    yardRow: "04",
    yardSlot: "19",
    gpsDeviceId: "GPS-9001",
  });

  assert.equal(createdAsset.status, "available");
  assert.equal(createdAsset.yardSlot, "19");

  const transferredAsset = await platform.transferAsset(createdAsset.id, {
    branchId: branchB,
    yardZone: "B",
    yardRow: "08",
    yardSlot: "02",
    reason: "Preposition for Dallas dispatch",
  });

  assert.equal(transferredAsset.branch, "Beta Branch");
  assert.equal(transferredAsset.yardSlot, "02");

  const contract = await platform.createContract({
    contractNumber: "CTR-9001",
    customerId,
    locationId,
    branchId: branchB,
    startDate,
    endDate,
    status: "reserved",
    lines: [
      {
        assetId: transferredAsset.id,
        unitPrice: 100,
        unit: "month",
        quantity: 1,
        startDate,
        endDate,
        adjustments: [],
      },
    ],
  });

  let asset = (await platform.listAssets()).find((entry) => entry.id === transferredAsset.id);
  assert.equal(asset?.status, "reserved");
  assert.equal(asset?.activeContractNumber, contract.contractNumber);

  const deliveryTask = await platform.createDispatchTask({
    type: "delivery",
    status: "assigned",
    branch: "Beta Branch",
    assetNumber: transferredAsset.assetNumber,
    contractNumber: contract.contractNumber,
    customerSite: "Alpha Jobsite",
    scheduledFor: "2026-04-02T13:00:00.000Z",
  });

  asset = (await platform.listAssets()).find((entry) => entry.id === transferredAsset.id);
  assert.equal(asset?.status, "dispatched");
  assert.equal(asset?.activeDispatchTaskId, deliveryTask.id);

  await platform.confirmDispatchTask(deliveryTask.id, {
    outcome: "delivery_confirmed",
    completedAt: "2026-04-02T15:00:00.000Z",
  });

  asset = (await platform.listAssets()).find((entry) => entry.id === transferredAsset.id);
  assert.equal(asset?.status, "on_rent");
  assert.equal(asset?.activeContractNumber, contract.contractNumber);

  const pickupTask = await platform.createDispatchTask({
    type: "pickup",
    status: "assigned",
    branch: "Beta Branch",
    assetNumber: transferredAsset.assetNumber,
    contractNumber: contract.contractNumber,
    customerSite: "Alpha Jobsite",
    scheduledFor: "2026-04-30T13:00:00.000Z",
  });

  await platform.confirmDispatchTask(pickupTask.id, {
    outcome: "pickup_confirmed",
    completedAt: "2026-04-30T16:00:00.000Z",
  });

  asset = (await platform.listAssets()).find((entry) => entry.id === transferredAsset.id);
  assert.equal(asset?.status, "inspection_hold");

  const requestedInspection = (await platform.listInspections({
    assetNumber: transferredAsset.assetNumber,
  })).find((inspection) => inspection.status === "requested");
  assert.ok(requestedInspection);

  await platform.completeInspection(requestedInspection!.id, {
    status: "needs_review",
    damageSummary: "Brake line damage found during return inspection.",
  });

  asset = (await platform.listAssets()).find((entry) => entry.id === transferredAsset.id);
  assert.equal(asset?.status, "in_maintenance");
  assert.equal(asset?.activeWorkOrderStatus, "open");

  const workOrders = await platform.listWorkOrders({
    assetNumber: transferredAsset.assetNumber,
  });
  assert.ok(workOrders.length > 0);

  const [line] = await db
    .select({
      id: schema.contractLines.id,
      unitPrice: schema.contractLines.unitPrice,
    })
    .from(schema.contractLines)
    .where(eq(schema.contractLines.contractId, contract.id));

  await platform.amendContract(contract.id, {
    amendmentType: "rate_adjustment",
    notes: "Apply premium pricing for post-inspection repair reserve.",
    lineUpdates: [
      {
        lineId: line!.id,
        unitPrice: 125,
        quantity: 1,
        adjustments: ["repair_reserve"],
      },
    ],
  });

  const refreshedContract = (await platform.listContracts()).find(
    (entry) => entry.id === contract.id,
  );
  assert.equal(refreshedContract?.value, 125);
});
