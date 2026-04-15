import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import type { ResolvedActor } from "@/lib/server/authorization";
import { getActorFromHeaders } from "@/lib/server/authorization";
import { createId, now } from "@/lib/server/production-utils";

export type WorkspaceLayoutValue = Record<string, unknown>;

export type WorkspaceActorSummary = {
  ownerKey: string;
  displayName: string;
  subtitle: string;
  initials: string;
  roleKey: string;
  kind: "system" | "staff" | "portal" | "anonymous";
};

function workspaceOwnerKey(actor: ResolvedActor | null) {
  if (!actor) {
    return "anonymous:shared";
  }
  if (actor.kind === "system") {
    return "system:metro-trailer";
  }
  if (actor.kind === "staff") {
    return actor.authUserId ? `staff:${actor.authUserId}` : `staff-user:${actor.userId}`;
  }
  return actor.authUserId
    ? `portal:${actor.authUserId}`
    : `portal-account:${actor.portalAccountId}`;
}

function initialsFor(value: string) {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "MT";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function actorSummary(actor: ResolvedActor | null): WorkspaceActorSummary {
  if (!actor) {
    return {
      ownerKey: workspaceOwnerKey(null),
      displayName: "Local Console",
      subtitle: "Anonymous workspace",
      initials: "LC",
      roleKey: "anonymous",
      kind: "anonymous",
    };
  }

  if (actor.kind === "system") {
    return {
      ownerKey: workspaceOwnerKey(actor),
      displayName: actor.name,
      subtitle: "System workspace",
      initials: initialsFor(actor.name),
      roleKey: "system",
      kind: "system",
    };
  }

  if (actor.kind === "portal") {
    return {
      ownerKey: workspaceOwnerKey(actor),
      displayName: actor.name,
      subtitle: "Portal workspace",
      initials: initialsFor(actor.name),
      roleKey: "portal",
      kind: "portal",
    };
  }

  return {
    ownerKey: workspaceOwnerKey(actor),
    displayName: actor.name,
    subtitle: actor.roleKeys[0] ?? actor.kind,
    initials: initialsFor(actor.name),
    roleKey: actor.roleKeys[0] ?? actor.kind,
    kind: "staff",
  };
}

function mergeLayouts(
  defaults: WorkspaceLayoutValue,
  stored?: WorkspaceLayoutValue | null,
) {
  return {
    ...defaults,
    ...(stored ?? {}),
  };
}

export async function getWorkspaceActorSummary(inputHeaders: Headers) {
  const actor = await getActorFromHeaders(inputHeaders);
  return actorSummary(actor);
}

export async function getWorkspaceLayout(
  inputHeaders: Headers,
  pageKey: string,
  defaults: WorkspaceLayoutValue,
) {
  const actor = await getActorFromHeaders(inputHeaders);
  const summary = actorSummary(actor);
  const row = await db.query.workspaceLayouts.findFirst({
    where: (table, { and, eq: localEq }) =>
      and(localEq(table.ownerKey, summary.ownerKey), localEq(table.pageKey, pageKey)),
  });

  return {
    actor: summary,
    pageKey,
    layout: mergeLayouts(defaults, (row?.layout as WorkspaceLayoutValue | null) ?? null),
  };
}

export async function saveWorkspaceLayout(
  inputHeaders: Headers,
  pageKey: string,
  layout: WorkspaceLayoutValue,
) {
  const actor = await getActorFromHeaders(inputHeaders);
  const summary = actorSummary(actor);
  const existing = await db.query.workspaceLayouts.findFirst({
    columns: {
      id: true,
    },
    where: (table, { and, eq: localEq }) =>
      and(localEq(table.ownerKey, summary.ownerKey), localEq(table.pageKey, pageKey)),
  });

  await db
    .insert(schema.workspaceLayouts)
    .values({
      id: existing?.id ?? createId("workspace"),
      ownerKey: summary.ownerKey,
      pageKey,
      layout,
      createdAt: now(),
      updatedAt: now(),
    })
    .onConflictDoUpdate({
      target: [schema.workspaceLayouts.ownerKey, schema.workspaceLayouts.pageKey],
      set: {
        layout,
        updatedAt: now(),
      },
    });

  return {
    ownerKey: summary.ownerKey,
    pageKey,
    layout,
  };
}

export async function listWorkspaceLayouts(inputHeaders: Headers) {
  const actor = await getActorFromHeaders(inputHeaders);
  const summary = actorSummary(actor);
  const rows = await db
    .select({
      pageKey: schema.workspaceLayouts.pageKey,
      layout: schema.workspaceLayouts.layout,
    })
    .from(schema.workspaceLayouts)
    .where(eq(schema.workspaceLayouts.ownerKey, summary.ownerKey));

  return {
    actor: summary,
    layouts: Object.fromEntries(
      rows.map((row) => [row.pageKey, row.layout as WorkspaceLayoutValue]),
    ),
  };
}
