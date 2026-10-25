/**
 * Base URL for server-side isomorphic fetches to this process's own API.
 * Must be loopback / internal listen URL — NOT public HTTPS PUBLIC_ORIGIN
 * (Dokploy TLS frontends are often unreachable from inside the container).
 */
export function ssrApiOrigin(): string {
  return (
    process.env.APP_ORIGIN?.trim() ||
    `http://127.0.0.1:${process.env.PORT || 3000}`
  ).replace(/\/+$/, "");
}
