// pollos.cz client shell — runs once per session.
// Owns the persistent YouTube player, mini-player control, and the
// home-page logo spin. Lives outside the htmx-swapped #page subtree.

/**
 * Minimal shape of the YouTube IFrame Player we actually use.
 * Full API: https://developers.google.com/youtube/iframe_api_reference
 * @typedef {Object} YTPlayer
 * @property {() => void} unMute
 * @property {(volume: number) => void} setVolume
 * @property {() => void} playVideo
 * @property {() => void} pauseVideo
 * @property {() => number} getPlayerState
 */

/** @type {YTPlayer | null} */
let player = null
let playerReady = false
let started = false
// Set when the user clicks before the YT API has finished loading; consumed
// in onReady so the click intent isn't lost.
let pendingStart = false

const mini = document.getElementById('mini-player')

/**
 * Reflect YT playback state on the mini-player: toggles the `playing` class
 * (CSS swaps the visible icon) and updates the a11y label.
 * @param {boolean} playing  true when the player is playing or buffering.
 * @returns {void}
 */
function setMiniState(playing) {
  mini.classList.toggle('playing', playing)
  mini.setAttribute('aria-label', playing ? 'Pause music' : 'Play music')
}

/**
 * YouTube IFrame API entry point — invoked by the IFrame loader when ready.
 * Wires up the hidden player and reveals the mini-player once it can accept commands.
 * @returns {void}
 */
window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player('yt', {
    videoId: 'HHF0xlf-bjY',
    playerVars: { playsinline: 1, controls: 0 },
    events: {
      onReady: () => {
        playerReady = true
        mini.hidden = false
        if (pendingStart) {
          pendingStart = false
          startPlayback()
        }
      },
      onStateChange: e => {
        // YT.PlayerState: PLAYING=1, PAUSED=2, ENDED=0, BUFFERING=3
        setMiniState(e.data === 1 || e.data === 3)
      },
    },
  })
}

/**
 * Unmute, max volume, start playback. First-play helper — subsequent
 * play/pause toggles go through {@link togglePlayback} via the mini button.
 * If the YT API hasn't loaded yet, queue the intent for onReady.
 * @returns {void}
 */
function startPlayback() {
  if (!playerReady) {
    pendingStart = true
    return
  }
  player.unMute()
  player.setVolume(100)
  player.playVideo()
  started = true
}

/**
 * Toggle YouTube playback based on the current player state.
 * No-op until the player is ready and {@link startPlayback} has primed it.
 * @returns {void}
 */
function togglePlayback() {
  if (!started) {
    startPlayback()
    return
  }
  const state = player.getPlayerState()
  if (state === 1 || state === 3) player.pauseVideo()
  else player.playVideo()
}

mini.addEventListener('click', togglePlayback)

// Home-page logo: spin + start playback. Delegated so it survives htmx swaps.
let angle = 0
let rate = 0

document.addEventListener('click', e => {
  if (!(e.target instanceof Element) || !e.target.closest('#logo')) return
  rate += 360
  if (!started) startPlayback()
})

let last = performance.now()

/**
 * RequestAnimationFrame loop. Decays click-induced spin rate and rotates the
 * home-page logo (when present in the DOM). Cheap when the logo is gone —
 * just decays the counter.
 * @param {DOMHighResTimeStamp} now  rAF timestamp.
 * @returns {void}
 */
function tick(now) {
  const dt = (now - last) / 1000
  last = now
  rate = Math.max(0, rate - dt * 180)
  const logo = document.getElementById('logo')
  if (logo && rate > 0.1) {
    angle = (angle + rate * dt + 360) % 360
    logo.style.transform = `translateZ(0) rotate(${angle}deg)`
  }
  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)
