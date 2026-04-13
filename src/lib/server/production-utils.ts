import { createHash, randomUUID } from "node:crypto";

export function createId(prefix: string) {
  return `${prefix}_${randomUUID().slice(0, 12)}`;
}

export function now() {
  return new Date();
}

export function nowIso() {
  return now().toISOString();
}

export function toIso(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function toDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
}

export function numericToNumber(
  value: string | number | null | undefined,
  fallback = 0,
) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

export function hashValue(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, current) => {
      if (current && typeof current === "object" && !Array.isArray(current)) {
        return Object.fromEntries(
          Object.entries(current as Record<string, unknown>).sort(([a], [b]) =>
            a.localeCompare(b),
          ),
        );
      }

      return current;
    },
  );
}

export function slugifySegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
