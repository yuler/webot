import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { newId, nowIso } from "./crypto";
import { ensureBindingForUser } from "./bindings";

export function findOrCreateUser(email: string): { id: string; email: string; created: boolean } {
  const existing = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
  if (existing) {
    ensureBindingForUser(existing.id);
    return { id: existing.id, email: existing.email, created: false };
  }

  const id = newId();
  const createdAt = nowIso();
  db.insert(schema.users).values({ id, email, createdAt }).run();
  ensureBindingForUser(id);
  return { id, email, created: true };
}

export function getUserById(id: string) {
  return db.select().from(schema.users).where(eq(schema.users.id, id)).get() ?? null;
}
