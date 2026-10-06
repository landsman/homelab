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
// A page that throws while rendering would still answer 200: the router only
// logs the error (renderRouterToStream) and the page goes out with the failed
// part missing. The prerender writes whatever answers 200, so the build would
// pass with a broken page in it. Counting those logs turns them into a 500,
// which stops it.
// ponytail: one count for every request, so an error during one page may fail
// another rendered at the same time — either way the build stops, which is the
// point.
let renderErrors = 0;
const log = console.error;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].startsWith("Error in render")) renderErrors++;
  log(...args);
};

export default {
  async fetch(request: Request): Promise<Response> {
    const before = renderErrors;
    const streamed = await handler.fetch(request);
    // Read to the end: a part that fails can fail after the first bytes are out.
    const body = await streamed.text();
    if (renderErrors > before)
      return new Response(`render error in ${new URL(request.url).pathname}`, { status: 500 });
    const response = new Response(body, streamed);
    const isNotFoundPage = new URL(request.url).pathname === ROUTES.notFound;
    if (!isNotFoundPage || response.status !== 404) return response;
    return new Response(response.body, { status: 200, headers: response.headers });
  },
};
