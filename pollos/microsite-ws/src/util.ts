// YYYY-MM-DD in UTC — the key the daily budget rolls over on.
export function utcDay(): string {
  return new Date().toISOString().slice(0, 10)
}

export function nextUtcMidnight(): number {
  const now = new Date()
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
}

export function secondsUntilUtcMidnight(): number {
  return Math.ceil((nextUtcMidnight() - Date.now()) / 1000)
}

// Cursor coords are normalized to 0..1 (viewport-relative) so they survive
// differing screen sizes. Coerce to a finite, clamped number.
export function clamp01(n: unknown): number {
  const v = Number(n)
  if (!Number.isFinite(v)) return 0
  return v < 0 ? 0 : v > 1 ? 1 : v
}
