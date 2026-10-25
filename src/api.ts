/**
 * Bun HTTP API + ClawBot QR assets + (prod) TanStack Start UI via Nitro standard fetch.
 */

import path from "node:path";
import { pathToFileURL } from "node:url";
import { lanAddresses, lanPage } from "./lan";
import { requestOtp, consumeOtp, consumeMagicToken } from "./auth/otp";
import {
  SESSION_COOKIE,
  clearSessionCookieHeader,
  createSession,
  destroySession,
  getSessionUser,
  parseCookies,
  sessionCookieHeader,
  type SessionUser,
} from "./auth/session";
import { findOrCreateUser } from "./auth/users";
import {
  disconnectBinding,
  ensureBindingForUser,
  resetBindCode,
} from "./auth/bindings";
import { listMessagesForUser } from "./auth/messages";

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  });
}

function userFromRequest(req: Request): SessionUser | null {
  const cookies = parseCookies(req.headers.get("cookie"));
  return getSessionUser(cookies[SESSION_COOKIE]);
}

async function readJson(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function requireUser(req: Request): SessionUser | Response {
  const user = userFromRequest(req);
  if (!user) return json({ error: "unauthorized" }, 401);
  return user;
}

type FetchHandler = (req: Request) => Response | Promise<Response>;
let uiFetch: FetchHandler | null | undefined;

/** Load TanStack Start / Nitro `standard` build (exports `{ fetch }`, does not listen). */
async function getUiFetch(): Promise<FetchHandler | null> {
  if (uiFetch !== undefined) return uiFetch;
  const candidates = [
    path.join(process.cwd(), ".output", "server", "index.mjs"),
    path.join(import.meta.dir, "..", ".output", "server", "index.mjs"),
  ];
  for (const file of candidates) {
    try {
      const mod = await import(pathToFileURL(file).href);
      const fetchFn = mod.default?.fetch ?? mod.fetch;
      if (typeof fetchFn === "function") {
        console.log(`[UI] serving TanStack Start from ${file}`);
        uiFetch = fetchFn as FetchHandler;
        return uiFetch;
      }
    } catch {
      // try next
    }
  }
  uiFetch = null;
  return null;
}

/** Fallback static files (assets + optional index.html shell). */
async function tryStatic(pathname: string): Promise<Response | null> {
  const roots = ["./.output/public", "./dist/client", "./public"];
  for (const root of roots) {
    const filePath = `${root}${pathname === "/" ? "/index.html" : pathname}`;
    const file = Bun.file(filePath);
    if (await file.exists()) {
      const type =
        pathname.endsWith(".js") || pathname.endsWith(".mjs")
          ? "application/javascript"
          : pathname.endsWith(".css")
            ? "text/css"
            : pathname.endsWith(".svg")
              ? "image/svg+xml"
              : pathname.endsWith(".html") || pathname === "/"
                ? "text/html; charset=utf-8"
                : undefined;
      return new Response(file, {
        headers: type ? { "Content-Type": type } : undefined,
      });
    }
  }

  if (!pathname.startsWith("/api") && !pathname.startsWith("/qrcode") && pathname !== "/status") {
    for (const root of roots) {
      const index = Bun.file(`${root}/index.html`);
      if (await index.exists()) {
        return new Response(index, {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
        });
      }
    }
  }
  return null;
}

function issueSession(email: string): { headers: Record<string, string>; body: object } {
  const account = findOrCreateUser(email);
  const session = createSession(account.id);
  const binding = ensureBindingForUser(account.id);
  return {
    headers: { "Set-Cookie": sessionCookieHeader(session.token, session.expiresAt) },
    body: { ok: true, email: account.email, binding },
  };
}

export function startApiServer(): ReturnType<typeof Bun.serve> {
  const port = Number(process.env.PORT || 3000);
  const hostname = process.env.HOST || "0.0.0.0";

  // Eagerly probe UI build (non-fatal if missing in API-only / test)
  void getUiFetch();

  const server = Bun.serve({
    hostname,
    port,
    async fetch(req) {
      const url = new URL(req.url);
      const { pathname } = url;

      if (pathname === "/qrcode.png") {
        if (!lanPage.png) return new Response("qr not ready", { status: 404 });
        return new Response(lanPage.png, {
          headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
        });
      }

      if (pathname === "/status") {
        return json({
          status: lanPage.status,
          message: lanPage.message,
          rev: lanPage.rev,
          botReady: lanPage.status === "ready" || lanPage.status === "confirmed",
        });
      }

      if (pathname === "/api/health") {
        return json({ ok: true });
      }

      if (pathname === "/api/auth/request-otp" && req.method === "POST") {
        const body = await readJson(req);
        const result = await requestOtp(String(body?.email || ""));
        if (!result.ok) {
          const headers: Record<string, string> = {};
          if (result.retryAfterSec) headers["Retry-After"] = String(result.retryAfterSec);
          return json({ error: result.error, retryAfterSec: result.retryAfterSec }, 429, headers);
        }
        return json({ ok: true });
      }

      if (pathname === "/api/auth/verify-otp" && req.method === "POST") {
        const body = await readJson(req);
        const consumed = consumeOtp(String(body?.email || ""), String(body?.code || ""));
        if (!consumed.ok) return json({ error: consumed.error }, 400);
        const issued = issueSession(consumed.email);
        return json(issued.body, 200, issued.headers);
      }

      // Magic link: GET sets cookie and redirects to /console
      if (pathname === "/api/auth/magic" && req.method === "GET") {
        const token = url.searchParams.get("token") || "";
        const consumed = consumeMagicToken(token);
        if (!consumed.ok) {
          return new Response(null, {
            status: 302,
            headers: { Location: `/login?error=${encodeURIComponent(consumed.error)}` },
          });
        }
        const issued = issueSession(consumed.email);
        return new Response(null, {
          status: 302,
          headers: {
            Location: "/console",
            "Set-Cookie": issued.headers["Set-Cookie"]!,
          },
        });
      }

      if (pathname === "/api/auth/logout" && (req.method === "POST" || req.method === "GET")) {
        const cookies = parseCookies(req.headers.get("cookie"));
        destroySession(cookies[SESSION_COOKIE]);
        if (req.headers.get("accept")?.includes("text/html") || req.method === "GET") {
          return new Response(null, {
            status: 302,
            headers: { Location: "/login", "Set-Cookie": clearSessionCookieHeader() },
          });
        }
        return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookieHeader() });
      }

      if (pathname === "/api/me") {
        const user = requireUser(req);
        if (user instanceof Response) return user;
        const binding = ensureBindingForUser(user.id);
        return json({ user, binding });
      }

      if (pathname === "/api/binding" && req.method === "GET") {
        const user = requireUser(req);
        if (user instanceof Response) return user;
        return json({ binding: ensureBindingForUser(user.id) });
      }

      if (pathname === "/api/binding/reset" && req.method === "POST") {
        const user = requireUser(req);
        if (user instanceof Response) return user;
        return json({ binding: resetBindCode(user.id) });
      }

      if (pathname === "/api/binding/disconnect" && req.method === "POST") {
        const user = requireUser(req);
        if (user instanceof Response) return user;
        return json({ binding: disconnectBinding(user.id) });
      }

      if (pathname === "/api/messages" && req.method === "GET") {
        const user = requireUser(req);
        if (user instanceof Response) return user;
        const limit = Math.min(Number(url.searchParams.get("limit") || 100), 500);
        return json({ messages: listMessagesForUser(user.id, limit) });
      }

      // Prod UI: serve hashed assets from disk first (Nitro standard asset map
      // can 404 when the server bundle is imported under Bun), then SSR via Nitro.
      if (!pathname.startsWith("/api")) {
        const staticResp = await tryStatic(pathname);
        if (staticResp) return staticResp;

        const nitro = await getUiFetch();
        if (nitro) {
          try {
            const res = await nitro(req);
            // If Nitro misses a public file, tryStatic already ran; return SSR/HTML as-is.
            return res;
          } catch (err) {
            console.warn("[UI] nitro fetch failed:", err);
          }
        }
      }

      return json({ error: "not found" }, 404);
    },
  });

  console.log("[API] listening:");
  for (const u of lanAddresses(port)) {
    console.log(`  ${u}`);
  }
  return server;
}

export const startWebServer = startApiServer;
