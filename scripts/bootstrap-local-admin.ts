import "dotenv/config";

import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";

import { db, pool, schema } from "../src/lib/db";
import { createId, now } from "../src/lib/server/production-utils";

const adminEmail = process.env.LOCAL_ADMIN_EMAIL?.trim() || "admin@metrotrailer.local";
const adminPassword = process.env.LOCAL_ADMIN_PASSWORD || "problematic";
const adminName = process.env.LOCAL_ADMIN_NAME?.trim() || "Local Administrator";

async function ensureLocalBranch() {
  const existing = await db.query.branches.findFirst({
    where: (table, operators) =>
      operators.or(operators.eq(table.code, "LOCAL"), operators.eq(table.id, "branch_local")),
  });

  if (existing) {
    return existing.id;
  }

  const branchId = "branch_local";
  await db.insert(schema.branches).values({
    id: branchId,
    code: "LOCAL",
    name: "Local HQ",
    timezone: "America/New_York",
    phone: "555-0100",
    email: "localhq@metrotrailer.local",
    address: {
      line1: "100 Local Yard Way",
      city: "New York",
      region: "NY",
      postalCode: "10001",
      country: "US",
    },
    createdAt: now(),
    updatedAt: now(),
  });

  return branchId;
}

async function ensureAuthUser() {
  const existing = await db.query.authUsers.findFirst({
    where: (table, { eq: localEq }) => localEq(table.email, adminEmail),
  });

  if (existing) {
    await db
      .update(schema.authUsers)
      .set({
        name: adminName,
        emailVerified: true,
        updatedAt: now(),
      })
      .where(eq(schema.authUsers.id, existing.id));

    return existing.id;
  }

  const authUserId = createId("auth");
  await db.insert(schema.authUsers).values({
    id: authUserId,
    name: adminName,
    email: adminEmail,
    emailVerified: true,
    image: null,
    twoFactorEnabled: false,
    createdAt: now(),
    updatedAt: now(),
  });

  return authUserId;
}

async function ensureCredentialAccount(authUserId: string) {
  const passwordHash = await hashPassword(adminPassword);
  const existing = await db.query.authAccounts.findFirst({
    where: (table, operators) =>
      operators.and(
        operators.eq(table.userId, authUserId),
        operators.eq(table.providerId, "credential"),
      ),
  });

  if (existing) {
    await db
      .update(schema.authAccounts)
      .set({
        accountId: authUserId,
        password: passwordHash,
        updatedAt: now(),
      })
      .where(eq(schema.authAccounts.id, existing.id));

    return existing.id;
  }

  const accountId = createId("acct");
  await db.insert(schema.authAccounts).values({
    id: accountId,
    accountId: authUserId,
    providerId: "credential",
    userId: authUserId,
    accessToken: null,
    refreshToken: null,
    idToken: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
    scope: null,
    password: passwordHash,
    createdAt: now(),
    updatedAt: now(),
  });

  return accountId;
}

async function ensureStaffUser(authUserId: string, branchId: string) {
  const existing = await db.query.users.findFirst({
    where: (table, operators) =>
      operators.or(
        operators.eq(table.authUserId, authUserId),
        operators.eq(table.email, adminEmail),
      ),
  });

  if (existing) {
    await db
      .update(schema.users)
      .set({
        authUserId,
        email: adminEmail,
        name: adminName,
        role: "admin",
        active: true,
        branchId,
        updatedAt: now(),
      })
      .where(eq(schema.users.id, existing.id));

    return existing.id;
  }

  const userId = createId("user");
  await db.insert(schema.users).values({
    id: userId,
    authUserId,
    email: adminEmail,
    name: adminName,
    role: "admin",
    active: true,
    branchId,
    createdAt: now(),
    updatedAt: now(),
  });

  return userId;
}

async function ensureBranchMembership(userId: string, branchId: string) {
  const existing = await db.query.userBranchMemberships.findFirst({
    where: (table, operators) =>
      operators.and(
        operators.eq(table.userId, userId),
        operators.eq(table.branchId, branchId),
      ),
  });

  if (existing) {
    return existing.id;
  }

  const membershipId = createId("ubm");
  await db.insert(schema.userBranchMemberships).values({
    id: membershipId,
    userId,
    branchId,
    isPrimary: true,
    createdAt: now(),
  });

  return membershipId;
}

async function main() {
  const branchId = await ensureLocalBranch();
  const authUserId = await ensureAuthUser();
  await ensureCredentialAccount(authUserId);
  const userId = await ensureStaffUser(authUserId, branchId);
  await ensureBranchMembership(userId, branchId);

  console.log(
    JSON.stringify(
      {
        email: adminEmail,
        password: adminPassword,
        branchId,
        userId,
        authUserId,
      },
      null,
      2,
    ),
  );
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
