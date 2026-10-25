/**
 * Bun HTTP API + ClawBot QR assets.
 * React/TanStack Start UI talks to these endpoints (same-origin in prod; Vite proxy in dev).
 */

import { lanAddresses, lanPage } from "./lan";
import { requestOtp, consumeOtp } from "./auth/otp";
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

/** Try serve a built TanStack Start / Vite client asset. */
async function tryStatic(pathname: string): Promise<Response | null> {
  const roots = ["./dist/client", "./.output/public", "./public"];
  // SPA fallback: unknown paths → index.html when build exists
  for (const root of roots) {
    const file = Bun.file(`${root}${pathname === "/" ? "/index.html" : pathname}`);
    if (await file.exists()) {
      const type =
        pathname.endsWith(".js")
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

export function startApiServer(): ReturnType<typeof Bun.serve> {
  const port = Number(process.env.PORT || 3000);
  const hostname = process.env.HOST || "0.0.0.0";

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
        if (!result.ok) return json({ error: result.error }, 400);
        return json({ ok: true });
      }

      if (pathname === "/api/auth/verify-otp" && req.method === "POST") {
        const body = await readJson(req);
        const consumed = consumeOtp(String(body?.email || ""), String(body?.code || ""));
        if (!consumed.ok) return json({ error: consumed.error }, 400);
        const account = findOrCreateUser(consumed.email);
        const session = createSession(account.id);
        const binding = ensureBindingForUser(account.id);
        return json(
          { ok: true, email: account.email, binding },
          200,
          { "Set-Cookie": sessionCookieHeader(session.token, session.expiresAt) },
        );
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

      const staticResp = await tryStatic(pathname);
      if (staticResp) return staticResp;

      return json({ error: "not found" }, 404);
    },
  });

  console.log("[API] listening:");
  for (const u of lanAddresses(port)) {
    console.log(`  ${u}`);
  }
  return server;
}

// re-export for callers that still import startWebServer name
export const startWebServer = startApiServer;
