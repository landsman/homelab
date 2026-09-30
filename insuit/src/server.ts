import handler from "@tanstack/react-start/server-entry";
import { ROUTES } from "@/app/routes";

// The server only ever runs at build time, to render each page into its HTML
// file. One thing differs from the default: 404.html.
//
// Pages answers every unknown address with that file, and the router then takes
// the page over at that address, where it matches no route. So the file has to
// be what the router renders for no route — not a page of its own, or React
// finds a different tree than the one in the file. ROUTES.notFound is
// therefore a path with no route behind it, and the prerender, which refuses
// to write anything but a 200, is told 200 for it.
export default {
  async fetch(request: Request): Promise<Response> {
    const response = await handler.fetch(request);
    const isNotFoundPage = new URL(request.url).pathname === ROUTES.notFound;
    if (!isNotFoundPage || response.status !== 404) return response;
    return new Response(response.body, { status: 200, headers: response.headers });
  },
};
