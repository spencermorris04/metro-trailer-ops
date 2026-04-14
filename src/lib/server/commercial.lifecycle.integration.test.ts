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
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "metro-trailer-commercial-it-"));
  const port = 56432 + Math.floor(Math.random() * 1000);
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
    AUTH_SECRET: "commercial-lifecycle-test-secret",
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
  process.env.AUTH_SECRET = "commercial-lifecycle-test-secret";
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

test("commercial lifecycle stays unified across signature, invoicing, receivables, and contract closeout", async (t) => {
  const harness = await bootstrapTestDatabase();
  t.after(async () => {
    await harness.stop();
  });

  const [{ db, schema }, platform, { ApiError }] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/server/platform"),
    import("@/lib/server/api"),
  ]);

  const branchId = "branch_finance";
  const customerId = "customer_finance";
  const locationId = "location_finance";
  const startDate = new Date("2026-04-01T00:00:00.000Z");
  const endDate = new Date("2026-04-15T00:00:00.000Z");

  await db.insert(schema.branches).values({
    id: branchId,
    code: "FIN",
    name: "Finance Branch",
    timezone: "America/New_York",
    address: {
      line1: "10 Ledger Ln",
      city: "Atlanta",
      state: "GA",
      postalCode: "30301",
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.insert(schema.customers).values({
    id: customerId,
    customerNumber: "CUST-FIN",
    name: "Finance Ready Builders",
    customerType: "commercial",
    contactInfo: {
      name: "Alex Accounts",
      email: "alex@example.com",
    },
    billingAddress: {
      line1: "100 Billing Rd",
      city: "Atlanta",
      state: "GA",
      postalCode: "30301",
    },
    branchCoverage: [branchId],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.insert(schema.customerLocations).values({
    id: locationId,
    customerId,
    name: "Finance Jobsite",
    address: {
      line1: "22 Jobsite Ave",
      city: "Atlanta",
      state: "GA",
      postalCode: "30302",
    },
    contactPerson: {
      name: "Taylor Supervisor",
      phone: "555-0200",
    },
    isPrimary: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const asset = await platform.createAsset({
    assetNumber: "TR-FIN-1",
    type: "commercial_box_trailer",
    branchId,
    status: "available",
    dimensions: "48 x 102",
  });

  const contract = await platform.createContract({
    contractNumber: "CTR-FIN-1",
    customerId,
    locationId,
    branchId,
    startDate,
    endDate,
    status: "reserved",
    lines: [
      {
        assetId: asset.id,
        unitPrice: 250,
        unit: "month",
        quantity: 1,
        startDate,
        endDate,
      },
    ],
  });

  const signatureRequestId = "sig_finance_1";
  const requestedAt = new Date("2026-04-01T10:00:00.000Z");
  await db.insert(schema.signatureRequests).values({
    id: signatureRequestId,
    contractId: contract.id,
    customerId,
    provider: "Metro Trailer",
    status: "sent",
    title: "Finance rental agreement",
    subject: "Please sign",
    message: "Please sign before execution.",
    consentTextVersion: "metro-esign-consent-v1",
    certificationText: "Certification",
    documentId: null,
    finalDocumentId: null,
    certificateDocumentId: null,
    signingFields: [],
    expiresAt: new Date("2026-04-08T10:00:00.000Z"),
    requestedAt,
    createdByUserId: null,
    updatedAt: requestedAt,
  });

  await assert.rejects(
    platform.transitionContract(contract.id, "active"),
    (error: unknown) =>
      error instanceof ApiError &&
      error.status === 409 &&
      String(error.message).includes("incomplete signature workflow"),
  );

  await platform.createFinancialEvent({
    contractId: contract.id,
    eventType: "rent",
    description: "First month rent",
    amount: 250,
    eventDate: startDate,
    status: "posted",
  });

  await assert.rejects(
    platform.generateInvoiceForContract(contract.id),
    (error: unknown) =>
      error instanceof ApiError &&
      error.status === 409 &&
      String(error.message).includes("incomplete signature workflow"),
  );

  await db
    .update(schema.signatureRequests)
    .set({
      status: "completed",
      completedAt: new Date("2026-04-01T12:00:00.000Z"),
      updatedAt: new Date("2026-04-01T12:00:00.000Z"),
    })
    .where(eq(schema.signatureRequests.id, signatureRequestId));

  let refreshedContract = (await platform.listContracts()).find(
    (entry) => entry.id === contract.id,
  );
  assert.equal(refreshedContract?.signatureStatus, "completed");
  assert.equal(refreshedContract?.commercialStage, "reserved_ready");

  refreshedContract = await platform.transitionContract(contract.id, "active");
  assert.equal(refreshedContract.status, "active");

  const invoice = await platform.generateInvoiceForContract(contract.id);
  assert.equal(invoice.totalAmount, 250);

  await platform.transitionContract(contract.id, "completed");

  await db
    .update(schema.assetAllocations)
    .set({
      active: false,
      endsAt: new Date("2026-04-16T00:00:00.000Z"),
      updatedAt: new Date(),
    })
    .where(eq(schema.assetAllocations.contractId, contract.id));

  await platform.recordInvoicePayment(invoice.id, 250);

  refreshedContract = (await platform.listContracts()).find(
    (entry) => entry.id === contract.id,
  );
  assert.equal(refreshedContract?.status, "closed");
  assert.equal(refreshedContract?.outstandingBalance, 0);
  assert.equal(refreshedContract?.openInvoiceCount, 0);
});
