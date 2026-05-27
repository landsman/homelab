// pollos.cz live cursors — shows other visitors' pointers in realtime.
//
// Connects to the microsite-ws Worker (a Durable Object relay) and renders one
// labeled cursor per peer. Runs once in the persistent client shell alongside
// app.js; the cursor layer is appended to <body>, outside #page, so it survives
// htmx swaps.
//
// Cost guardrails (the relay is on Cloudflare's free tier): we only run on fine
// pointers (desktop), throttle sends to ~22/s, pause while the tab is hidden,
// and drop the socket after a stretch of no movement.

/** @typedef {{ el: HTMLDivElement, lastSeen: number }} Peer */

// In local dev, talk to the microsite-ws Worker on `wrangler dev` (:8787);
// in production, the Terraform-managed custom domain.
const LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
const WS_URL = LOCAL
  ? `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.hostname}:8787/cursors`
  : 'wss://microsite-ws.pollos.cz/cursors'
const SEND_INTERVAL_MS = 45 // ~22 messages/sec while the pointer is moving
const IDLE_DISCONNECT_MS = 60_000 // drop the socket after this long without movement
const STALE_PEER_MS = 10_000 // forget a peer we stop hearing from (missed leave)
const MAX_RECONNECT_MS = 30_000
const PAUSED_JITTER_MS = 5 * 60_000 // spread reconnects after the daily budget resets

const ADJECTIVES = ['Swift', 'Sneaky', 'Crispy', 'Golden', 'Spicy', 'Mellow', 'Zesty', 'Bold']
const NOUNS = ['Pollo', 'Hermano', 'Rooster', 'Chick', 'Wing', 'Drumstick', 'Nugget', 'Gallo']

// Each peer's cursor is a Breaking Bad character (pixel-art SVGs in
// img/icons/cursors/, picked by data-char in cursors.css). The character is
// derived from the relay-assigned peer id — a stable UUID — so every client
// renders the same face for a given peer without the relay carrying an extra
// field.
const CHARACTERS = [
  'heisenberg',
  'jesse',
  'gus',
  'saul',
  'mike',
  'hazmat',
  'tuco',
  'hector',
  'meth',
  'meth2',
]

// Caption shown under each cursor (see .cursor-label in cursors.css).
const CHARACTER_NAMES = {
  heisenberg: 'Heisenberg',
  jesse: 'Jesse',
  gus: 'Gus',
  saul: 'Saul',
  mike: 'Mike',
  hazmat: 'Hazmat',
  tuco: 'Tuco',
  hector: 'Hector',
  meth: 'Meth',
  meth2: 'Meth',
}

/**
 * Pick a random element from an array.
 * @param {string[]} arr
 * @returns {string}
 */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Map a peer id to a stable character key (same id always yields the same one).
 * @param {string} id
 * @returns {string}
 */
function characterFor(id) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return CHARACTERS[hash % CHARACTERS.length]
}

// Only desktop pointers get cursors — touch devices have nothing to show and
// would just burn the relay's free-tier budget.
if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
  startCursors()
}

/**
 * Wire up the cursor layer, the WebSocket lifecycle, and the input listeners.
 * @returns {void}
 */
function startCursors() {
  const NAME = `${pick(ADJECTIVES)} ${pick(NOUNS)}`
  const COLOR = `hsl(${Math.floor(Math.random() * 360)} 70% 55%)`

  const layer = document.createElement('div')
  layer.className = 'cursors-layer'
  layer.setAttribute('aria-hidden', 'true')
  document.body.appendChild(layer)

  /** @type {Map<string, Peer>} */
  const peers = new Map()

  /** @type {WebSocket | null} */
  let ws = null
  let myId = null
  let reconnectDelay = 1000
  let reconnectTimer = 0
  let paused = false
  let intentionalClose = false

  // Latest pointer position, normalized 0..1 so it survives differing screens.
  let x = 0.5
  let y = 0.5
  let moved = false
  let lastMove = performance.now()

  // Cache viewport size and refresh on resize — reading window.innerWidth/Height
  // inside the high-frequency pointermove/render paths would force layout.
  let width = window.innerWidth
  let height = window.innerHeight
  window.addEventListener(
    'resize',
    () => {
      width = window.innerWidth
      height = window.innerHeight
    },
    { passive: true }
  )

  /**
   * Open the relay connection (no-op if already open or paused).
   * @returns {void}
   */
  function connect() {
    if (ws || paused) return
    ws = new WebSocket(WS_URL)
    ws.addEventListener('open', () => {
      reconnectDelay = 1000
    })
    ws.addEventListener('message', onMessage)
    ws.addEventListener('close', onClose)
    ws.addEventListener('error', () => ws && ws.close())
  }

  /**
   * @param {MessageEvent} e
   * @returns {void}
   */
  function onMessage(e) {
    let msg
    try {
      msg = JSON.parse(e.data)
    } catch {
      return
    }
    if (msg.type === 'welcome') {
      myId = msg.id
    } else if (msg.type === 'move' && msg.id !== myId) {
      upsertPeer(msg)
    } else if (msg.type === 'leave') {
      removePeer(msg.id)
    } else if (msg.type === 'paused') {
      // Relay hit its daily budget (resets at UTC midnight). Stand down until
      // then, plus jitter, so we don't reconnect-storm a still-blocked server
      // or stampede all clients at the reset.
      paused = true
      const now = new Date()
      const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
      const delay = midnight - now.getTime() + Math.random() * PAUSED_JITTER_MS
      setTimeout(() => {
        paused = false
      }, delay)
    }
  }

  /**
   * @returns {void}
   */
  function onClose() {
    ws = null
    clearPeers()
    if (intentionalClose) {
      intentionalClose = false // idle/hidden — reconnect on the next move
      return
    }
    if (paused) return
    clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(connect, reconnectDelay)
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_MS)
  }

  /**
   * Create or move a peer's cursor element.
   * @param {{ id: string, x: number, y: number, name?: string, color?: string }} msg
   * @returns {void}
   */
  function upsertPeer(msg) {
    let peer = peers.get(msg.id)
    if (!peer) {
      const character = characterFor(msg.id)
      const el = document.createElement('div')
      el.className = 'cursor'
      el.dataset.char = character
      el.style.color = msg.color || '#888'
      // The character pixel-art comes from a cached SVG chosen by data-char via
      // CSS background-image (see cursors.css); the label sits below it.
      const arrow = document.createElement('span')
      arrow.className = 'cursor-arrow'
      const label = document.createElement('span')
      label.className = 'cursor-label'
      label.textContent = CHARACTER_NAMES[character] || 'Guest'
      el.append(arrow, label)
      layer.appendChild(el)
      peer = { el, lastSeen: 0 }
      peers.set(msg.id, peer)
    }
    peer.lastSeen = performance.now()
    const px = msg.x * width
    const py = msg.y * height
    peer.el.style.transform = `translate(${px}px, ${py}px)`
  }

  /**
   * @param {string} id
   * @returns {void}
   */
  function removePeer(id) {
    const peer = peers.get(id)
    if (!peer) return
    peers.delete(id)
    // Play the leave animation (see cursors.css), then drop the element.
    peer.el.classList.add('is-leaving')
    setTimeout(() => peer.el.remove(), 160)
  }

  /**
   * @returns {void}
   */
  function clearPeers() {
    peers.forEach(peer => peer.el.remove())
    peers.clear()
  }

  // Throttled sender — emits at most one move per interval, only when the
  // pointer actually moved and the socket is open.
  setInterval(() => {
    if (paused || !moved || !ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'move', x, y, name: NAME, color: COLOR }))
    moved = false
  }, SEND_INTERVAL_MS)

  // Housekeeping: forget stale peers, and disconnect once the user goes idle.
  setInterval(() => {
    const now = performance.now()
    peers.forEach((peer, id) => {
      if (now - peer.lastSeen > STALE_PEER_MS) removePeer(id)
    })
    if (ws && ws.readyState === WebSocket.OPEN && now - lastMove > IDLE_DISCONNECT_MS) {
      intentionalClose = true
      ws.close()
    }
  }, 5_000)

  document.addEventListener(
    'pointermove',
    e => {
      x = e.clientX / (width || 1)
      y = e.clientY / (height || 1)
      moved = true
      lastMove = performance.now()
      if (!ws && !paused) connect() // reconnect after going idle
    },
    { passive: true }
  )

  // Pause while the tab is hidden — no point streaming a cursor nobody sees.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Also cancel any pending reconnect so it can't fire while hidden.
      clearTimeout(reconnectTimer)
      reconnectTimer = 0
      if (ws) {
        intentionalClose = true
        ws.close()
      }
    } else if (!ws && !paused) {
      connect()
    }
  })

  connect()
}
