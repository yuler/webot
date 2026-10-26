import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.join(import.meta.dir, "..");

function runSnippet(script: string, env: Record<string, string> = {}): {
  exitCode: number;
  stdout: string;
  stderr: string;
} {
  const p = path.join(import.meta.dir, `_security_high_tmp_${process.pid}.ts`);
  fs.writeFileSync(p, script);
  try {
    const r = Bun.spawnSync({
      cmd: ["bun", "run", p],
      cwd: repoRoot,
      env: { ...process.env, ...env },
    });
    return {
      exitCode: r.exitCode ?? 1,
      stdout: r.stdout.toString(),
      stderr: r.stderr.toString(),
    };
  } finally {
    try {
      fs.unlinkSync(p);
    } catch {}
  }
}

test("assertProductionSecrets exits on missing SESSION_SECRET in production", () => {
  const r = runSnippet(
    `
process.env.NODE_ENV = "production";
delete process.env.SESSION_SECRET;
const { assertProductionSecrets } = await import("../src/auth/secrets.ts");
assertProductionSecrets();
console.log("SHOULD_NOT_REACH");
`,
    { NODE_ENV: "production", SESSION_SECRET: "" },
  );
  expect(r.exitCode).not.toBe(0);
  expect(r.stderr + r.stdout).toMatch(/SESSION_SECRET/);
  expect(r.stdout).not.toContain("SHOULD_NOT_REACH");
});

test("assertProductionSecrets exits on placeholder SESSION_SECRET in production", () => {
  const r = runSnippet(
    `
process.env.NODE_ENV = "production";
process.env.SESSION_SECRET = "change-me-to-a-long-random-string";
const { assertProductionSecrets } = await import("../src/auth/secrets.ts");
assertProductionSecrets();
console.log("SHOULD_NOT_REACH");
`,
    {
      NODE_ENV: "production",
      SESSION_SECRET: "change-me-to-a-long-random-string",
    },
  );
  expect(r.exitCode).not.toBe(0);
  expect(r.stdout).not.toContain("SHOULD_NOT_REACH");
});

test("assertProductionSecrets allows strong secret in production", () => {
  const r = runSnippet(
    `
process.env.NODE_ENV = "production";
process.env.SESSION_SECRET = "a-strong-production-secret-32b";
const { assertProductionSecrets } = await import("../src/auth/secrets.ts");
assertProductionSecrets();
console.log("OK");
`,
    {
      NODE_ENV: "production",
      SESSION_SECRET: "a-strong-production-secret-32b",
    },
  );
  expect(r.exitCode).toBe(0);
  expect(r.stdout).toContain("OK");
});

test("assertProductionSecrets is a no-op outside production", () => {
  const r = runSnippet(
    `
process.env.NODE_ENV = "development";
delete process.env.SESSION_SECRET;
const { assertProductionSecrets } = await import("../src/auth/secrets.ts");
assertProductionSecrets();
console.log("OK");
`,
    { NODE_ENV: "development", SESSION_SECRET: "" },
  );
  expect(r.exitCode).toBe(0);
  expect(r.stdout).toContain("OK");
});

test("session cookies include Secure when NODE_ENV=production (no COOKIE_SECURE)", () => {
  const r = runSnippet(
    `
process.env.NODE_ENV = "production";
delete process.env.COOKIE_SECURE;
const { clearSessionCookieHeader, sessionCookieHeader } = await import("../src/auth/session.ts");
const clear = clearSessionCookieHeader();
const set = sessionCookieHeader("tok", new Date(Date.now() + 60000).toISOString());
if (!clear.includes("Secure")) throw new Error("clear missing Secure: " + clear);
if (!set.includes("Secure")) throw new Error("set missing Secure: " + set);
console.log("OK");
`,
    { NODE_ENV: "production", COOKIE_SECURE: "" },
  );
  expect(r.exitCode).toBe(0);
  expect(r.stdout).toContain("OK");
});
