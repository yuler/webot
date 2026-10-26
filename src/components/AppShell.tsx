import type { ReactNode } from "react";
import { AppBar } from "@/components/AppBar";

type AppShellProps = {
  children: ReactNode;
  /** Content max width: md ≈ login, lg ≈ home/console. The AppBar always spans lg. */
  size?: "md" | "lg";
};

/** App-like frame: full-bleed sticky top bar + one centered content column. */
export function AppShell({ children, size = "lg" }: AppShellProps) {
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        跳到正文
      </a>
      <AppBar />
      <main id="main" className={`app-main container${size === "md" ? " container--md" : ""}`}>
        {children}
      </main>
    </div>
  );
}
