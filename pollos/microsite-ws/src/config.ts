import type { CursorRoom } from './cursor-room'

export interface Env {
  CURSORS: DurableObjectNamespace<CursorRoom>
}

// ── Free-tier guardrails ────────────────────────────────────────────────────
// The Workers Free plan allows 100k requests/day; inbound WebSocket messages
// bill at 20:1, so the hard ceiling is ~2,000,000 messages/day. These limits
// keep us comfortably under it and degrade gracefully (pause + refuse) rather
// than letting the platform start erroring mid-stream.
export const DAILY_MESSAGE_BUDGET = 1_500_000 // ~75% of the ~2M/day ceiling
export const MAX_PEERS = 60 // concurrent cursors in the room
export const SOCKET_BUCKET_CAPACITY = 60 // per-socket burst allowance
export const SOCKET_REFILL_PER_SEC = 40 // per-socket sustained msgs/sec (> client's ~22/s)
export const CHECKPOINT_EVERY = 2_000 // persist the daily counter every N messages

// Only allow WebSocket upgrades from our own origins. Browsers always send a
// trustworthy Origin on the WS handshake, so this stops third-party sites from
// embedding the relay and draining the free-tier budget. Non-browser clients
// (no Origin) are allowed through — they can't be used for cross-site embedding.
export const ALLOWED_HOSTS = new Set(['pollos.cz', 'www.pollos.cz', 'localhost', '127.0.0.1'])

// endpoints
export const ROUTES = {
  health: '/health',
  cursors: '/cursors',
}
