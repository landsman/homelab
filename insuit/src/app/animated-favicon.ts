/* Animated favicon — a slowly rotating two-tone disc, the same motif as the
   theme toggle.

   Swapping <link rel="icon"> href is the only technique that actually
   animates: Chrome dropped animated-GIF favicons, and no browser animates
   SVG (SMIL or CSS) in a favicon. So the frames are rendered to data URIs
   once at load and then cycled — no per-frame canvas work.

   The static /assets/icons/favicon.svg covers the page until this runs. */

/** Number of frames in one full revolution. */
const FRAMES = 24;
/** Milliseconds per frame — one revolution takes FRAMES * TICK ms. */
const TICK = 90;
/** Canvas size. 64 so the icon stays crisp on a 2x display. */
const SIZE = 64;

/** Draw the disc rotated by `angle` radians and return it as a PNG data URI. */
function frame(angle: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  const r = SIZE / 2 - 3;

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

/** Starts the animation; the function it returns stops it. */
export function animateFavicon(): () => void {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]');
  if (!link || matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};

  const frames = Array.from({ length: FRAMES }, (_, i) => frame((i / FRAMES) * Math.PI * 2));
  let index = 0;
  let timer: number | undefined;

  // Run only while the tab is visible — a background tab animating its own
  // favicon is pure wasted wakeups.
  const sync = () => {
    if (document.hidden) {
      clearInterval(timer);
      timer = undefined;
    } else if (timer === undefined) {
      timer = window.setInterval(() => {
        index = (index + 1) % FRAMES;
        link.href = frames[index];
      }, TICK);
    }
  };

  document.addEventListener("visibilitychange", sync);
  sync();

  return () => {
    document.removeEventListener("visibilitychange", sync);
    clearInterval(timer);
  };
}
