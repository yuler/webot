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
import { createTenantForUser, findOrCreateUser, listTenantsForUser } from "./auth/tenants";

function html(body: string, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...extraHeaders } });
}

function layout(title: string, content: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · WeBot</title>
<style>
  :root { color-scheme: dark light; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #0f1115; color: #f3f4f6; }
  a { color: #93c5fd; }
  main { max-width: 560px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 1.4rem; margin: 0 0 8px; }
  .muted { color: #9ca3af; font-size: 0.9rem; line-height: 1.5; }
  .card { background: #171a21; border: 1px solid #2a2f3a; border-radius: 12px;
    padding: 20px; margin-top: 20px; }
  label { display: block; font-size: 0.85rem; margin-bottom: 6px; color: #d1d5db; }
  input { width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 8px;
    border: 1px solid #374151; background: #0b0d12; color: inherit; font-size: 1rem; }
  button, .btn { display: inline-block; margin-top: 12px; padding: 10px 16px; border: 0;
    border-radius: 8px; background: #3b82f6; color: white; font-weight: 600; cursor: pointer;
    text-decoration: none; font-size: 0.95rem; }
  button.secondary { background: #374151; }
  .err { color: #fca5a5; margin-top: 10px; font-size: 0.9rem; }
  .ok { color: #86efac; margin-top: 10px; font-size: 0.9rem; }
  ul.tenants { list-style: none; padding: 0; margin: 12px 0 0; }
  ul.tenants li { padding: 12px; border: 1px solid #2a2f3a; border-radius: 8px; margin-bottom: 8px; }
  .nav { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; font-size: 0.9rem; }
  img.qr { width: min(80vw, 280px); height: auto; background: #fff; border-radius: 12px; }
</style>
<main>
${content}
</main>
</html>`;
}

function userFromRequest(req: Request): SessionUser | null {
  const cookies = parseCookies(req.headers.get("cookie"));
  return getSessionUser(cookies[SESSION_COOKIE]);
}

function loginPage(msg = "", err = ""): string {
  return layout(
    "登录",
    `<div class="nav"><a href="/clawbot">ClawBot 扫码</a></div>
     <h1>邮箱验证码登录</h1>
     <p class="muted">输入邮箱收取 6 位验证码。开发环境未配置邮件时，验证码会打印在服务端日志 / <code>data/otp-dev.log</code>。</p>
     <div class="card">
       <form id="f">
         <label for="email">邮箱</label>
         <input id="email" name="email" type="email" required autocomplete="email" placeholder="you@example.com">
         <label for="code" style="margin-top:12px">验证码</label>
         <input id="code" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="6 位数字">
         <div style="display:flex;gap:8px;flex-wrap:wrap">
           <button type="button" id="send">发送验证码</button>
           <button type="submit">登录</button>
         </div>
         <p class="ok" id="ok">${msg}</p>
         <p class="err" id="err">${err}</p>
       </form>
     </div>
     <script>
       const ok = document.getElementById('ok');
       const err = document.getElementById('err');
       document.getElementById('send').onclick = async () => {
         ok.textContent = ''; err.textContent = '';
         const email = document.getElementById('email').value;
         const res = await fetch('/api/auth/request-otp', {
           method: 'POST', headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ email })
         });
         const data = await res.json();
         if (!res.ok) { err.textContent = data.error || '发送失败'; return; }
         ok.textContent = '验证码已发送（开发环境请看服务端日志）';
       };
       document.getElementById('f').onsubmit = async (e) => {
         e.preventDefault();
         ok.textContent = ''; err.textContent = '';
         const email = document.getElementById('email').value;
         const code = document.getElementById('code').value;
         const res = await fetch('/api/auth/verify-otp', {
           method: 'POST', headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ email, code })
         });
         const data = await res.json();
         if (!res.ok) { err.textContent = data.error || '登录失败'; return; }
         location.href = '/console';
       };
     </script>`,
  );
}

function consolePage(user: SessionUser): string {
  const tenants = listTenantsForUser(user.id);
  const list = tenants.length
    ? `<ul class="tenants">${tenants
        .map(
          (t) =>
            `<li><strong>${escapeHtml(t.name)}</strong><br><span class="muted">${escapeHtml(t.slug)} · ${escapeHtml(t.role)}</span></li>`,
        )
        .join("")}</ul>`
    : `<p class="muted">还没有工作区。</p>`;

  return layout(
    "控制台",
    `<div class="nav">
       <a href="/console">控制台</a>
       <a href="/clawbot">ClawBot 扫码</a>
       <a href="/api/auth/logout">退出</a>
     </div>
     <h1>控制台</h1>
     <p class="muted">已登录：${escapeHtml(user.email)}</p>
     <div class="card">
       <h2 style="margin:0 0 8px;font-size:1.05rem">工作区（tenants）</h2>
       <p class="muted">第一刀仅账号骨架。ClawBot 仍是进程级单 worker，会话文件未按 tenant 拆分。</p>
       ${list}
       <form method="post" action="/api/tenants" style="margin-top:16px">
         <label for="name">新建工作区</label>
         <input id="name" name="name" required maxlength="80" placeholder="例如 Acme">
         <button type="submit">创建</button>
       </form>
     </div>`,
  );
}

function clawbotPage(): string {
  return layout(
    "ClawBot",
    `<div class="nav"><a href="/login">邮箱登录</a> · <a href="/console">控制台</a></div>
     <h1>微信 ClawBot 扫码</h1>
     <p class="muted">微信 → 我 → 设置 → 插件 → ClawBot，扫描此二维码并确认。</p>
     <div class="card" style="text-align:center">
       <img class="qr" id="qr" alt="登录二维码" src="/qrcode.png">
       <p id="msg" style="margin-top:12px">${escapeHtml(lanPage.message)}</p>
     </div>
     <script>
       async function tick() {
         try {
           const res = await fetch("/status", { cache: "no-store" });
           const data = await res.json();
           document.getElementById("msg").textContent = data.message || data.status;
           const hold = data.status === "scaned" || data.status === "confirmed" || data.status === "ready";
           if (!hold && data.rev && data.rev !== window.__qrRev) {
             window.__qrRev = data.rev;
             document.getElementById("qr").src = "/qrcode.png?rev=" + encodeURIComponent(data.rev);
           }
         } catch {}
       }
       setInterval(tick, 2000);
     </script>`,
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function readJson(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export function startWebServer(): void {
  const port = Number(process.env.PORT || 3000);
  const hostname = process.env.HOST || "0.0.0.0";

  Bun.serve({
    hostname,
    port,
    async fetch(req) {
      const url = new URL(req.url);
      const { pathname } = url;
      const user = userFromRequest(req);

      if (pathname === "/qrcode.png") {
        if (!lanPage.png) return new Response("qr not ready", { status: 404 });
        return new Response(lanPage.png, {
          headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
        });
      }

      if (pathname === "/status") {
        return json({ status: lanPage.status, message: lanPage.message, rev: lanPage.rev });
      }

      if (pathname === "/" || pathname === "/login") {
        if (user && pathname === "/") {
          return Response.redirect("/console", 302);
        }
        return html(loginPage());
      }

      if (pathname === "/clawbot") {
        return html(clawbotPage());
      }

      if (pathname === "/console") {
        if (!user) return Response.redirect("/login", 302);
        return html(consolePage(user));
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
        return json(
          { ok: true, email: account.email },
          200,
          { "Set-Cookie": sessionCookieHeader(session.token, session.expiresAt) },
        );
      }

      if (pathname === "/api/auth/logout") {
        const cookies = parseCookies(req.headers.get("cookie"));
        destroySession(cookies[SESSION_COOKIE]);
        return new Response(null, {
          status: 302,
          headers: {
            Location: "/login",
            "Set-Cookie": clearSessionCookieHeader(),
          },
        });
      }

      if (pathname === "/api/me") {
        if (!user) return json({ error: "unauthorized" }, 401);
        return json({ user, tenants: listTenantsForUser(user.id) });
      }

      if (pathname === "/api/tenants" && req.method === "POST") {
        if (!user) return Response.redirect("/login", 302);
        let name = "";
        const ct = req.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const body = await readJson(req);
          name = String(body?.name || "");
        } else {
          const form = await req.formData();
          name = String(form.get("name") || "");
        }
        const created = createTenantForUser(user.id, name);
        if (!created.ok) {
          if (ct.includes("application/json")) return json({ error: created.error }, 400);
          return html(layout("控制台", `<p class="err">${escapeHtml(created.error)}</p><p><a href="/console">返回</a></p>`), 400);
        }
        if (ct.includes("application/json")) return json({ ok: true, tenant: created.tenant });
        return Response.redirect("/console", 302);
      }

      return html(layout("404", `<h1>Not found</h1><p class="muted"><a href="/">Home</a></p>`), 404);
    },
  });

  console.log("[Web] 控制台 / 登录页:");
  for (const u of lanAddresses(port)) {
    console.log(`  ${u}/login`);
  }
  console.log("[Web] ClawBot 扫码页:");
  for (const u of lanAddresses(port)) {
    console.log(`  ${u}/clawbot`);
  }
}
