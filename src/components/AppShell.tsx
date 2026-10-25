import type { ReactNode } from "react";
import { AppBar } from "@/components/AppBar";

type AppShellProps = {
  children: ReactNode;
  /** Content max width: md ≈ login/claw, lg ≈ home/console. */
  size?: "md" | "lg";
};

/** App-like frame: sticky top bar + single content column + safe spacing. */
export function AppShell({ children, size = "lg" }: AppShellProps) {
  return (
    <div className={`app-shell app-shell--${size}`}>
      <div className="app-shell-frame">
        <AppBar />
        <div className="app-shell-body">{children}</div>
      </div>
    </div>
  );
}
