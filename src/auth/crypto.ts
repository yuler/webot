export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function hashSecret(value: string): string {
  const pepper = process.env.SESSION_SECRET?.trim() || "webot-dev-insecure-secret";
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(`${pepper}:${value}`);
  return hasher.digest("hex");
}

export function randomOtpCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000;
  return String(n).padStart(6, "0");
}

/** Short human-typeable bind code for messaging ClawBot (e.g. WB-AB12CD). */
export function randomBindCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let body = "";
  for (const b of bytes) body += alphabet[b! % alphabet.length];
  return `WB-${body}`;
}

export function randomToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
