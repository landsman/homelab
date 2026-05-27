// Realtime WebSocket endpoint for the pollos.cz microsite.
//
// Today it powers live visitor cursors. Routing is path-based so more realtime
// features can share this Worker later without a new deployment.
//
// Wire protocol (JSON, both directions):
//   server -> client  { type: 'welcome', id }
//   client -> server  { type: 'move', x, y, name, color }      x,y in 0..1
//   server -> client  { type: 'move', id, x, y, name, color, country }
//   server -> client  { type: 'leave', id }
//   server -> client  { type: 'paused' }   daily budget hit; reconnect at reset

import { type Env, ALLOWED_HOSTS, ROUTES } from './config'

// Durable Object classes must be exported from the Worker's entry module.
export { CursorRoom } from './cursor-room'

function originAllowed(origin: string | null): boolean {
  if (!origin) return true
  try {
    return ALLOWED_HOSTS.has(new URL(origin).hostname)
  } catch {
    return false
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === ROUTES.health) {
      return new Response('ok\n', { status: 200 })
    }

    if (url.pathname === ROUTES.cursors) {
      if (!originAllowed(request.headers.get('Origin'))) {
        return new Response('forbidden origin\n', { status: 403 })
      }
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('expected a websocket upgrade\n', { status: 426 })
      }
      // Stamp the visitor's country (Cloudflare edge geo) onto the upgrade so
      // the room can attach it to the socket. It's edge-derived, never client-
      // supplied, so peers can't spoof it. `cf` is absent in local dev.
      const country = request.cf?.country ?? request.headers.get('CF-IPCountry') ?? ''
      const headers = new Headers(request.headers)
      headers.set('X-Visitor-Country', country)
      return env.CURSORS.getByName('global').fetch(new Request(request, { headers }))
    }

    return new Response('not found\n', { status: 404 })
  },
} satisfies ExportedHandler<Env>
