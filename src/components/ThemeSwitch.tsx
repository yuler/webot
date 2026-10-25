import { useEffect, useState } from "react";
import {
  applyTheme,
  getResolvedTheme,
  setTheme,
  type Theme,
} from "@/lib/theme";

/** DESIGN.md ThemeSwitch：两个直角按钮「黑」「白」 */
export function ThemeSwitch({ className = "" }: { className?: string }) {
  const [theme, setLocal] = useState<Theme>("dark");

  useEffect(() => {
    const resolved = getResolvedTheme();
    applyTheme(resolved);
    setLocal(resolved);
  }, []);

  function pick(next: Theme) {
    setTheme(next);
    setLocal(next);
  }

  return (
    <div className={`theme-switch ${className}`.trim()} role="group" aria-label="主题">
      <button
        type="button"
        aria-pressed={theme === "dark"}
        onClick={() => pick("dark")}
      >
        黑
      </button>
      <button
        type="button"
        aria-pressed={theme === "light"}
        onClick={() => pick("light")}
      >
        白
      </button>
    </div>
  );
}
