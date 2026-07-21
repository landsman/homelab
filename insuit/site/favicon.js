/* Animated favicon — a slowly rotating two-tone disc, the same motif as the
   theme toggle.

   Swapping <link rel="icon"> href is the only technique that actually
   animates: Chrome dropped animated-GIF favicons, and no browser animates
   SVG (SMIL or CSS) in a favicon. So the frames are rendered to data URIs
   once at load and then cycled — no per-frame canvas work.

   Deferred, not blocking: the static /favicon/mark.svg covers the page until
   this runs, and covers it entirely when JS is off. */

/** Number of frames in one full revolution. */
var FRAMES = 24;
/** Milliseconds per frame — one revolution takes FRAMES * TICK ms. */
var TICK = 90;
/** Canvas size. 64 so the icon stays crisp on a 2x display. */
var SIZE = 64;

(function () {
  var link = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
  if (!link || !window.HTMLCanvasElement) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  /**
   * Draw the disc rotated by `angle` and return it as a PNG data URI.
   * @param {number} angle Rotation in radians.
   * @returns {string} A data: URI for one frame.
   */
  function frame(angle) {
    var canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    var ctx = canvas.getContext("2d");
    var r = SIZE / 2 - 3;

    ctx.translate(SIZE / 2, SIZE / 2);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = "#e8eaec";
    ctx.fill();

    // Half disc, so the rotation is legible rather than a spinning circle.
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = "#16181a";
    ctx.fill();

    // Outline keeps the light half from vanishing on a light tab bar.
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = "#8a9099";
    ctx.lineWidth = 3;
    ctx.stroke();

    return canvas.toDataURL("image/png");
  }

  var frames = [];
  for (var i = 0; i < FRAMES; i++) frames.push(frame((i / FRAMES) * Math.PI * 2));

  var index = 0;
  var timer = null;

  /** Advance one frame. @returns {void} */
  function step() {
    index = (index + 1) % FRAMES;
    link.href = frames[index];
  }

  /**
   * Run only while the tab is visible — a background tab animating its own
   * favicon is pure wasted wakeups.
   * @returns {void}
   */
  function sync() {
    if (document.hidden) {
      clearInterval(timer);
      timer = null;
    } else if (timer === null) {
      timer = setInterval(step, TICK);
    }
  }

  document.addEventListener("visibilitychange", sync);
  sync();
})();
