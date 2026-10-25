import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { newId, nowIso } from "./crypto";

export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  role: string;
  createdAt: string;
};

export function findOrCreateUser(email: string): { id: string; email: string; created: boolean } {
  const existing = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
  if (existing) {
    return { id: existing.id, email: existing.email, created: false };
  }

  const id = newId();
  const createdAt = nowIso();
  db.insert(schema.users).values({ id, email, createdAt }).run();

  // Personal default workspace for first-slice single-worker ClawBot coexistence
  const tenantId = newId();
  const slug = `ws-${id.replace(/-/g, "").slice(0, 10)}`;
  db.insert(schema.tenants)
    .values({
      id: tenantId,
      name: "My workspace",
      slug,
      createdAt,
    })
    .run();
  db.insert(schema.memberships)
    .values({
      userId: id,
      tenantId,
      role: "owner",
      createdAt,
    })
    .run();

  return { id, email, created: true };
}

export function listTenantsForUser(userId: string): TenantRow[] {
  return db
    .select({
      id: schema.tenants.id,
      name: schema.tenants.name,
      slug: schema.tenants.slug,
      role: schema.memberships.role,
      createdAt: schema.tenants.createdAt,
    })
    .from(schema.memberships)
    .innerJoin(schema.tenants, eq(schema.memberships.tenantId, schema.tenants.id))
    .where(eq(schema.memberships.userId, userId))
    .all();
}

export function createTenantForUser(
  userId: string,
  name: string,
): { ok: true; tenant: TenantRow } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 80) {
    return { ok: false, error: "Name must be 1–80 characters" };
  }

  const id = newId();
  const createdAt = nowIso();
  const slugBase = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "workspace";
  const slug = `${slugBase}-${id.replace(/-/g, "").slice(0, 6)}`;

  db.insert(schema.tenants).values({ id, name: trimmed, slug, createdAt }).run();
  db.insert(schema.memberships)
    .values({ userId, tenantId: id, role: "owner", createdAt })
    .run();

  return {
    ok: true,
    tenant: { id, name: trimmed, slug, role: "owner", createdAt },
  };
}
