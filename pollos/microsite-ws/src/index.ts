// Realtime WebSocket endpoint for the pollos.cz microsite.
//
// Today it powers live visitor cursors. Routing is path-based so more realtime
// features can share this Worker later without a new deployment.
//
// Wire protocol (JSON, both directions):
//   server -> client  { type: 'welcome', id }
//   client -> server  { type: 'move', x, y, name, color }      x,y in 0..1
//   server -> client  { type: 'move', id, x, y, name, color }
//   server -> client  { type: 'leave', id }
//   server -> client  { type: 'paused' }   daily budget hit; reconnect at reset

import type { Env } from './config'

// Durable Object classes must be exported from the Worker's entry module.
export { CursorRoom } from './cursor-room'

// Only allow WebSocket upgrades from our own origins. Browsers always send a
// trustworthy Origin on the WS handshake, so this stops third-party sites from
// embedding the relay and draining the free-tier budget. Non-browser clients
// (no Origin) are allowed through — they can't be used for cross-site embedding.
const ALLOWED_HOSTS = new Set(['pollos.cz', 'www.pollos.cz', 'localhost', '127.0.0.1'])

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

    if (url.pathname === '/health') {
      return new Response('ok\n', { status: 200 })
    }

    if (url.pathname === '/cursors') {
      if (!originAllowed(request.headers.get('Origin'))) {
        return new Response('forbidden origin\n', { status: 403 })
      }
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('expected a websocket upgrade\n', { status: 426 })
      }
      return env.CURSORS.getByName('global').fetch(request)
    }

    return new Response('not found\n', { status: 404 })
  },
} satisfies ExportedHandler<Env>
