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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/health') {
      return new Response('ok\n', { status: 200 })
    }

    if (url.pathname === '/cursors') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('expected a websocket upgrade\n', { status: 426 })
      }
      return env.CURSORS.getByName('global').fetch(request)
    }

    return new Response('not found\n', { status: 404 })
  },
} satisfies ExportedHandler<Env>
