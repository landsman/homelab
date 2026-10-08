import { useRef, type TouchEvent } from "react";

type Point = { x: number; y: number };

/** How far a finger has to travel sideways before lifting it counts as a swipe. */
const THRESHOLD = 50;

/**
 * Which way a touch from `from` to `to` steps: +1 for a swipe left (the next one,
 * as on a phone), -1 for a swipe right, 0 for a tap or a mostly vertical drag.
 */
export function swipeStep(from: Point, to: Point): -1 | 0 | 1 {
  const dx = to.x - from.x;
  if (Math.abs(dx) <= THRESHOLD || Math.abs(dx) <= Math.abs(to.y - from.y)) return 0;
  return dx < 0 ? 1 : -1;
}

/** Touch handlers to spread on an element: a one-finger swipe calls `onStep(±1)`. */
export function useSwipe(onStep: (by: number) => void) {
  const start = useRef<Point | null>(null);
  return {
    onTouchStart: (event: TouchEvent) => {
      const finger = event.touches[0];
      // A second finger is a pinch, never a swipe.
      start.current = event.touches.length === 1 ? { x: finger.clientX, y: finger.clientY } : null;
    },
    onTouchEnd: (event: TouchEvent) => {
      const from = start.current;
      start.current = null;
      if (!from) return;
      const finger = event.changedTouches[0];
      const by = swipeStep(from, { x: finger.clientX, y: finger.clientY });
      if (by) onStep(by);
    },
  };
}
