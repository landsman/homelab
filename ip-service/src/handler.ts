import { match, P } from "ts-pattern";
import {
  handleHeadersRequest,
  handleIpRequest,
  handleIPv4Request,
  handleIPv6Request,
  handleNotFound,
} from "./endpoints";

const route = {
  INDEX: "/",
  IPV4: "/ipv4",
  IPV6: "/ipv6",
  HEADERS: "/headers",
};

/**
 * Main request orchestrator (Fetch API-style)
 */
export async function handleRequest(
  request: Request,
  server?: Bun.Server<unknown>,
): Promise<Response> {
  const { pathname: path } = new URL(request.url);

  return match(path)
    .with(route.INDEX, () => handleIpRequest(request, server))
    .with(route.IPV4, () => handleIPv4Request(request, server))
    .with(route.IPV6, () => handleIPv6Request(request, server))
    .with(route.HEADERS, () => handleHeadersRequest(request))
    .otherwise(() => handleNotFound());
}
