/**
 * Production boot guards for session hashing / cookies.
 * Dev keeps loose defaults; production must fail closed.
 */

/** Documented placeholders + the in-code hashSecret fallback. */
const INSECURE_SESSION_SECRETS = new Set([
  "",
  "change-me",
  "change-me-to-a-long-random-string",
  "webot-dev-insecure-secret",
]);

/** True when NODE_ENV=production (Dokploy / Docker prod). */
export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Refuse to start in production if SESSION_SECRET is missing or a known placeholder.
 * Call once after env load, before serving traffic.
 */
export function assertProductionSecrets(): void {
  if (!isProductionRuntime()) return;

  const secret = process.env.SESSION_SECRET?.trim() ?? "";
  if (!secret || INSECURE_SESSION_SECRETS.has(secret) || secret.length < 16) {
    console.error(
      "[fatal] SESSION_SECRET must be a strong random value (≥16 chars) in production. " +
        "Refusing to start with a missing/placeholder secret.",
    );
    process.exit(1);
  }
}
