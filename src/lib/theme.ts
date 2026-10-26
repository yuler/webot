const STORAGE_KEY = "theme";

export type Theme = "light" | "dark";

/** Matches the `ground` token so mobile browser chrome blends with the page. */
const THEME_COLOR: Record<Theme, string> = { dark: "#000000", light: "#ffffff" };

/** DESIGN.md: 默认是黑 */
export function getStoredTheme(): Theme | null {
  if (typeof localStorage === "undefined") return null;
  const value = localStorage.getItem(STORAGE_KEY);
  return value === "light" || value === "dark" ? value : null;
}

export function getResolvedTheme(): Theme {
  return getStoredTheme() ?? "dark";
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}

export function setTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

/** Inline boot script — keep in sync with STORAGE_KEY / default dark / THEME_COLOR */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t="dark";var r=document.documentElement;r.classList.toggle("dark",t==="dark");r.dataset.theme=t;r.style.colorScheme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="dark"?"#000000":"#ffffff");}catch(e){document.documentElement.classList.add("dark");}})();`;

export function toggleTheme() {
  setTheme(getResolvedTheme() === "dark" ? "light" : "dark");
}
