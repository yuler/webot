/** Injected by Vite `define` in vite.config.ts (Docker/CI env or local git/now). */
declare const __WEBOT_GIT_SHA__: string;
declare const __WEBOT_BUILD_TIME__: string;

export const BUILD_GIT_SHA =
  typeof __WEBOT_GIT_SHA__ !== "undefined" && __WEBOT_GIT_SHA__ ? __WEBOT_GIT_SHA__ : "unknown";

/** ISO-8601 build timestamp, or empty when unset. */
export const BUILD_TIME_ISO =
  typeof __WEBOT_BUILD_TIME__ !== "undefined" && __WEBOT_BUILD_TIME__
    ? __WEBOT_BUILD_TIME__
    : "";

/** Human-readable Asia/Shanghai local time for console meta. */
export function formatBuildTimeShanghai(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
