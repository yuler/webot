import os from "node:os";

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
