import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ClawQr } from "@/components/ClawQr";

export const Route = createFileRoute("/clawbot")({
  component: ClawBotPage,
});

function ClawBotPage() {
  return (
    <AppShell size="md">
      <h1 className="type-title text-center">微信 ClawBot 扫码</h1>
      <p className="type-meta mt-2 text-center">
        微信 → 我 → 设置 → 插件 → ClawBot，扫描并确认。登录后也可在控制台扫码。
      </p>

      <section className="panel mt-6">
        <ClawQr />
      </section>
    </AppShell>
  );
}
