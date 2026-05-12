/**
 * Resolves the real client IP from proxy headers (Cloudflare, nginx) with
 * Bun's socket address as a fallback for direct connections.
 */
export const getRealIp = (
  request: Request,
  server?: Bun.Server<unknown>,
): string => {
  const raw =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    server?.requestIP(request)?.address ||
    "unknown";
  return normalizeIP(raw);
};

/**
 * Converts IPv4-mapped IPv6 addresses (e.g. ::ffff:1.2.3.4) to plain IPv4.
 * Bun can return these when an IPv4 client connects to a dual-stack socket.
 */
const normalizeIP = (ip: string): string => {
  const v4mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return v4mapped ? v4mapped[1] : ip;
};
