import { eq, inArray } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { ApiError } from "@/lib/server/api";
import { isDemoRuntime } from "@/lib/server/runtime";

export const permissionCatalog = [
  "assets.view",
  "assets.manage",
  "customers.view",
  "customers.manage",
  "contracts.view",
  "contracts.manage",
  "dispatch.view",
  "dispatch.manage",
  "inspections.view",
  "inspections.manage",
  "maintenance.view",
  "maintenance.manage",
  "accounting.view",
  "accounting.manage",
  "collections.view",
  "collections.manage",
  "documents.view",
  "documents.manage",
  "signatures.view",
  "signatures.manage",
  "reports.view",
  "admin.manage",
  "portal.view",
  "portal.pay",
  "payment_methods.manage",
  "integrations.manage",
] as const;

export type PermissionKey = (typeof permissionCatalog)[number];

type PermissionScope = {
  branchId?: string | null;
  customerId?: string | null;
};

export type ResolvedActor = {
  kind: "system" | "staff" | "portal";
  authUserId: string | null;
  userId: string | null;
  portalAccountId: string | null;
  customerId: string | null;
  branchIds: string[];
  roleKeys: string[];
  permissionKeys: Set<string>;
  email: string;
  name: string;
};

function legacyRolePermissions(role: string) {
  switch (role) {
    case "admin":
      return new Set<string>(permissionCatalog);
    case "dispatcher":
      return new Set<string>([
        "assets.view",
        "contracts.view",
        "dispatch.view",
        "dispatch.manage",
        "inspections.view",
      ]);
    case "sales":
      return new Set<string>([
        "assets.view",
        "customers.view",
        "customers.manage",
        "contracts.view",
        "contracts.manage",
        "documents.view",
        "signatures.manage",
      ]);
    case "accounting":
      return new Set<string>([
        "customers.view",
        "contracts.view",
        "accounting.view",
        "accounting.manage",
        "collections.view",
        "collections.manage",
        "reports.view",
      ]);
    case "technician":
      return new Set<string>([
        "assets.view",
        "inspections.view",
        "inspections.manage",
        "maintenance.view",
        "maintenance.manage",
      ]);
    case "collections":
      return new Set<string>([
        "customers.view",
        "contracts.view",
        "collections.view",
        "collections.manage",
        "reports.view",
      ]);
    default:
      return new Set<string>(["assets.view"]);
  }
}

async function getStaffPermissions(userId: string) {
  const assignments = await db
    .select({
      roleKey: schema.roles.key,
      scopeType: schema.userRoleAssignments.scopeType,
      branchId: schema.userRoleAssignments.branchId,
      customerId: schema.userRoleAssignments.customerId,
      permissionId: schema.rolePermissions.permissionId,
    })
    .from(schema.userRoleAssignments)
    .innerJoin(schema.roles, eq(schema.userRoleAssignments.roleId, schema.roles.id))
    .leftJoin(
      schema.rolePermissions,
      eq(schema.rolePermissions.roleId, schema.userRoleAssignments.roleId),
    )
    .where(eq(schema.userRoleAssignments.userId, userId));

  const permissionIds = assignments
    .map((assignment) => assignment.permissionId)
    .filter((value): value is string => Boolean(value));

  const permissionRows =
    permissionIds.length > 0
      ? await db
          .select({
            id: schema.permissions.id,
            key: schema.permissions.key,
          })
          .from(schema.permissions)
          .where(inArray(schema.permissions.id, permissionIds))
      : [];

  return {
    roleKeys: [...new Set(assignments.map((assignment) => assignment.roleKey))],
    permissionKeys: new Set(permissionRows.map((row) => row.key)),
  };
}

export async function getActorFromHeaders(inputHeaders: Headers): Promise<ResolvedActor | null> {
  if (isDemoRuntime()) {
    return {
      kind: "system",
      authUserId: null,
      userId: null,
      portalAccountId: null,
      customerId: null,
      branchIds: [],
      roleKeys: ["system"],
      permissionKeys: new Set(permissionCatalog),
      email: "system@metrotrailer.local",
      name: "Metro Trailer System",
    };
  }

  const session = await auth.api.getSession({
    headers: inputHeaders,
  });

  if (!session) {
    return null;
  }

  const authUserId = session.user.id;
  const staffUser = await db.query.users.findFirst({
    where: (table, { eq: localEq }) => localEq(table.authUserId, authUserId),
  });

  if (staffUser) {
    const memberships = await db
      .select({
        branchId: schema.userBranchMemberships.branchId,
      })
      .from(schema.userBranchMemberships)
      .where(eq(schema.userBranchMemberships.userId, staffUser.id));

    const assigned = await getStaffPermissions(staffUser.id);
    const legacyPermissions =
      assigned.permissionKeys.size > 0
        ? assigned.permissionKeys
        : legacyRolePermissions(staffUser.role);

    return {
      kind: "staff",
      authUserId,
      userId: staffUser.id,
      portalAccountId: null,
      customerId: null,
      branchIds: memberships.map((membership) => membership.branchId),
      roleKeys: assigned.roleKeys.length > 0 ? assigned.roleKeys : [staffUser.role],
      permissionKeys: legacyPermissions,
      email: staffUser.email,
      name: staffUser.name,
    };
  }

  const portalAccount = await db.query.portalAccounts.findFirst({
    where: (table, { eq: localEq }) => localEq(table.authUserId, authUserId),
  });

  if (!portalAccount) {
    return null;
  }

  return {
    kind: "portal",
    authUserId,
    userId: null,
    portalAccountId: portalAccount.id,
    customerId: portalAccount.customerId,
    branchIds: [],
    roleKeys: ["portal"],
    permissionKeys: new Set([
      "portal.view",
      "portal.pay",
      "documents.view",
      "signatures.view",
      "contracts.view",
      "inspections.view",
      "accounting.view",
      "payment_methods.manage",
    ]),
    email: session.user.email,
    name: session.user.name,
  };
}

export function ensurePermission(
  actor: ResolvedActor | null,
  permission: PermissionKey,
  scope: PermissionScope = {},
) {
  if (!actor) {
    throw new ApiError(401, "Authentication is required.");
  }

  if (actor.permissionKeys.has("admin.manage") || actor.permissionKeys.has(permission)) {
    if (scope.customerId && actor.kind === "portal" && actor.customerId !== scope.customerId) {
      throw new ApiError(403, "Customer scope violation.");
    }

    if (
      scope.branchId &&
      actor.kind === "staff" &&
      actor.branchIds.length > 0 &&
      !actor.branchIds.includes(scope.branchId)
    ) {
      throw new ApiError(403, "Branch scope violation.");
    }

    return actor;
  }

  throw new ApiError(403, `Missing permission: ${permission}`);
}

export async function requireApiPermission(
  request: Request,
  permission: PermissionKey,
  scope: PermissionScope = {},
) {
  const actor = await getActorFromHeaders(new Headers(request.headers));
  return ensurePermission(actor, permission, scope);
}
