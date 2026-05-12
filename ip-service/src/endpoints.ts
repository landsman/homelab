import { getRealIp } from "./ip";

export enum ContentType {
  JSON = "application/json",
  TEXT = "text/plain",
}

export const out = (body: string, contentType: ContentType): Response =>
  new Response(body, {
    headers: { "Content-Type": contentType },
  });

/**
 * Ip address to return when the client is connected via IPv6 or IPv4.
 */
const NO_IP_RESPONSE: string = "none";

/**
 * Allowing user to ask for JSON format via query parameter.
 */
const isJsonFormat = (request: Request) =>
  new URL(request.url).searchParams.get("format") === "json";

/**
 * Returns the real IP address of the client.
 */
export const handleIpRequest = (
  request: Request,
  server?: Bun.Server<unknown>,
): Response => {
  const real = getRealIp(request, server);
  return out(`${real}\n`, ContentType.TEXT);
};

/**
 * Return headers as plain text or JSON based on a request format parameter
 */
export const handleHeadersRequest = (request: Request): Response => {
  if (isJsonFormat(request)) {
    const headerObject = Object.fromEntries(request.headers.entries());
    return out(JSON.stringify(headerObject, null, 2), ContentType.JSON);
  }

  const arr = [...request.headers.entries()].map(
    ([key, val]) => `${key}: ${val}`,
  );
  return out(`${arr.join("\n")}\n`, ContentType.TEXT);
};

/**
 * Returns the IP address in the requested format
 * @param request
 * @param ip
 */
const ipResponse = (request: Request, ip: string): Response => {
  if (isJsonFormat(request)) {
    return out(JSON.stringify({ ip }), ContentType.JSON);
  }
  return out(`${ip}\n`, ContentType.TEXT);
};

/**
 * Returns the IPv4 address, or "none" if the client connected via IPv6.
 */
export const handleIPv4Request = (
  request: Request,
  server?: Bun.Server<unknown>,
): Response => {
  const ip = getRealIp(request, server);
  if (ip.includes(":") || ip === "unknown") {
    return ipResponse(request, NO_IP_RESPONSE);
  }
  return ipResponse(request, ip);
};

/**
 * Returns the IPv6 address, or "none" if the client connected via IPv4
 */
export const handleIPv6Request = (
  request: Request,
  server?: Bun.Server<unknown>,
): Response => {
  const ip = getRealIp(request, server);
  if (!ip.includes(":")) {
    return ipResponse(request, NO_IP_RESPONSE);
  }
  return ipResponse(request, ip);
};

/**
 * 404
 */
export const handleNotFound = (): Response =>
  out("Not Found", ContentType.TEXT);
