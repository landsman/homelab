import { handleRequest } from "./handler";
import { applyNoCacheHeaders, NO_CACHE_HEADERS } from "./cache";

/**
 * Bun server configuration
 */
// noinspection JSUnusedGlobalSymbols
export default {
  port: 3000,
  async fetch(request: Request, server: Bun.Server<unknown>) {
    try {
      const response = await handleRequest(request, server);
      return applyNoCacheHeaders(response);
    } catch (err) {
      console.error("Server error:", err);
      return new Response("Internal Server Error", {
        status: 500,
        headers: NO_CACHE_HEADERS,
      });
    }
  },
};

console.log("IP Service (Bun) listening on port 3000");
