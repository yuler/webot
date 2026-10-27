import { useEffect, useState } from "react";
import {
  applyTheme,
  getResolvedTheme,
  setTheme,
  type Theme,
} from "@/lib/theme";

function SunIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      <path d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5z" />
    </svg>
  );
}

/** Top-right theme control: one icon, click toggles dark ↔ light. */
export function ThemeSwitch({ className = "" }: { className?: string }) {
  const [theme, setLocal] = useState<Theme>("dark");

  useEffect(() => {
    const resolved = getResolvedTheme();
    applyTheme(resolved);
    setLocal(resolved);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setLocal(next);
  }

  return (
    <button
      type="button"
      className={`theme-switch ${className}`.trim()}
      aria-label="切换主题"
      title={theme === "dark" ? "切换到白" : "切换到黑"}
      onClick={toggle}
    >
      {theme === "dark" ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
