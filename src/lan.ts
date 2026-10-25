import os from "node:os";

export type LanStatus =
  | "starting"
  | "wait"
  | "scaned"
  | "confirmed"
  | "expired"
  | "ready"
  | "error";

export const lanPage = {
  png: null as Buffer | null,
  status: "starting" as LanStatus,
  message: "正在申请登录二维码…",
  rev: "",
};

export function lanAddresses(port: number): string[] {
  const urls = [`http://127.0.0.1:${port}`];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      const isIPv4 = iface.family === "IPv4" || iface.family === 4;
      if (isIPv4 && !iface.internal) {
        urls.push(`http://${iface.address}:${port}`);
      }
    }
  }
  return urls;
}
