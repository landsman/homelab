import { DurableObject } from 'cloudflare:workers'

import {
  CHECKPOINT_EVERY,
  DAILY_MESSAGE_BUDGET,
  MAX_PEERS,
  SOCKET_BUCKET_CAPACITY,
  SOCKET_REFILL_PER_SEC,
  type Env,
} from './config'
import { clamp01, nextUtcMidnight, secondsUntilUtcMidnight, utcDay } from './util'

interface Attachment {
  id: string
}

interface MoveMessage {
  type?: string
  x?: unknown
  y?: unknown
  name?: unknown
  color?: unknown
}

interface Budget {
  day: string
  count: number
}

/**
 * One room of live cursors. Holds every connected socket (via the Hibernation
 * API) and rebroadcasts each cursor move to the others. The connection id is
 * assigned server-side, so a tab can never spoof another's cursor.
 */
export class CursorRoom extends DurableObject<Env> {
  // Per-socket token buckets — in memory, rebuilt lazily after hibernation.
  private buckets = new Map<WebSocket, { tokens: number; last: number }>()
  // Daily message counter, persisted so it survives eviction.
  private day = utcDay()
  private count = 0
  private blocked = false

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<Budget>('budget')
      if (saved && saved.day === this.day) this.count = saved.count
      this.blocked = this.count >= DAILY_MESSAGE_BUDGET
    })
  }

  async fetch(_request: Request): Promise<Response> {
    if (this.blocked) {
      return new Response('daily limit reached; back at 00:00 UTC\n', {
        status: 503,
        headers: { 'Retry-After': String(secondsUntilUtcMidnight()) },
      })
    }
    if (this.ctx.getWebSockets().length >= MAX_PEERS) {
      return new Response('room is full\n', {
        status: 503,
        headers: { 'Retry-After': '30' },
      })
    }

    const { 0: client, 1: server } = new WebSocketPair()

    // Hibernation-aware accept: the runtime keeps the socket open even after
    // this DO is evicted, waking it only to deliver messages.
    this.ctx.acceptWebSocket(server)

    const id = crypto.randomUUID()
    server.serializeAttachment({ id } satisfies Attachment)
    server.send(JSON.stringify({ type: 'welcome', id }))

    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== 'string') return

    // Per-socket rate limit. A flooding client is disconnected — its messages
    // are billed on arrival, so closing the socket is the only real cap.
    if (!this.takeToken(ws)) {
      this.dropSocket(ws, 1008, 'rate limit exceeded')
      return
    }

    const self = ws.deserializeAttachment() as Attachment | null
    if (!self) return

    let data: MoveMessage
    try {
      data = JSON.parse(raw) as MoveMessage
    } catch {
      return
    }
    if (data.type !== 'move') return

    // Roll the daily counter over at UTC midnight.
    const today = utcDay()
    if (today !== this.day) {
      this.day = today
      this.count = 0
      this.blocked = false
      await this.persist()
    }

    // Global guardrail: at the budget, tell everyone, close the room, and
    // refuse reconnects until midnight (cleared by the alarm). The static site
    // is untouched; nothing is billed beyond this point.
    if (this.count >= DAILY_MESSAGE_BUDGET) {
      await this.pauseUntilMidnight()
      return
    }

    this.count++
    if (this.count % CHECKPOINT_EVERY === 0) await this.persist()

    this.broadcast(
      JSON.stringify({
        type: 'move',
        id: self.id,
        x: clamp01(data.x),
        y: clamp01(data.y),
        name: String(data.name ?? '').slice(0, 24),
        color: String(data.color ?? '').slice(0, 24),
      }),
      ws,
    )
  }

  webSocketClose(ws: WebSocket): void {
    this.buckets.delete(ws)
    this.announceLeave(ws)
  }

  webSocketError(ws: WebSocket): void {
    this.buckets.delete(ws)
    this.announceLeave(ws)
  }

  // Fires at UTC midnight after a pause — lifts the block for the new day.
  async alarm(): Promise<void> {
    this.day = utcDay()
    this.count = 0
    this.blocked = false
    await this.persist()
  }

  // Refill-on-read token bucket; false once a socket has spent its burst.
  private takeToken(ws: WebSocket): boolean {
    const now = Date.now()
    let b = this.buckets.get(ws)
    if (!b) {
      b = { tokens: SOCKET_BUCKET_CAPACITY, last: now }
      this.buckets.set(ws, b)
    }
    b.tokens = Math.min(
      SOCKET_BUCKET_CAPACITY,
      b.tokens + ((now - b.last) / 1000) * SOCKET_REFILL_PER_SEC,
    )
    b.last = now
    if (b.tokens < 1) return false
    b.tokens -= 1
    return true
  }

  private dropSocket(ws: WebSocket, code: number, reason: string): void {
    try {
      ws.close(code, reason)
    } catch {
      /* already closing */
    }
    this.buckets.delete(ws)
    this.announceLeave(ws)
  }

  private announceLeave(ws: WebSocket): void {
    const self = ws.deserializeAttachment() as Attachment | null
    if (self) this.broadcast(JSON.stringify({ type: 'leave', id: self.id }), ws)
  }

  private broadcast(msg: string, except: WebSocket): void {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue
      try {
        ws.send(msg)
      } catch {
        // Socket mid-close; its close handler will clean up.
      }
    }
  }

  private async pauseUntilMidnight(): Promise<void> {
    this.blocked = true
    const notice = JSON.stringify({ type: 'paused' })
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(notice)
        ws.close(1013, 'daily limit reached; back at 00:00 UTC')
      } catch {
        /* already closing */
      }
    }
    this.buckets.clear()
    await this.persist()
    await this.ctx.storage.setAlarm(nextUtcMidnight())
  }

  private persist(): Promise<void> {
    return this.ctx.storage.put('budget', { day: this.day, count: this.count } satisfies Budget)
  }
}
