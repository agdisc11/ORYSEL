/**
 * Rise / set events and visibility windows.
 *
 * A body is "visible" when its centre is above the horizon in its direction.
 * The default horizon is the smooth sphere (0 degrees everywhere); the terrain
 * part plugs a LOLA-derived profile in here without touching anything else.
 */
import type { Horizon } from './types.ts'

export type Interval = [start: number, end: number]

export const smoothHorizon: Horizon = () => 0

/** Horizon from N evenly spaced samples (index 0 = north, clockwise). */
export function profileHorizon(elevationsDeg: number[]): Horizon {
  const n = elevationsDeg.length
  return (azDeg) => {
    const x = ((((azDeg % 360) + 360) % 360) / 360) * n
    const i = Math.floor(x) % n
    const frac = x - Math.floor(x)
    return elevationsDeg[i] * (1 - frac) + elevationsDeg[(i + 1) % n] * frac
  }
}

/**
 * Bisect a sign change of `margin` (degrees above the horizon) between two
 * times until the bracket is narrower than `toleranceS` seconds.
 */
export function refineCrossing(
  margin: (et: number) => number,
  lo: number,
  hi: number,
  toleranceS = 1,
): number {
  const aboveLo = margin(lo) > 0
  while (hi - lo > toleranceS) {
    const mid = 0.5 * (lo + hi)
    if (margin(mid) > 0 === aboveLo) lo = mid
    else hi = mid
  }
  return 0.5 * (lo + hi)
}

/** Visible intervals from a list of crossings sorted by time. */
export function windowsFromCrossings(
  crossings: { et: number; type: 'rise' | 'set' }[],
  startEt: number,
  endEt: number,
  visibleAtStart: boolean,
): Interval[] {
  const out: Interval[] = []
  let openAt: number | null = visibleAtStart ? startEt : null
  for (const c of crossings) {
    if (c.type === 'rise') openAt = c.et
    else if (openAt !== null) {
      out.push([openAt, c.et])
      openAt = null
    }
  }
  if (openAt !== null) out.push([openAt, endEt])
  return out
}

/** Intervals where both inputs overlap (sunlight AND direct line to Earth). */
export function intersect(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    const lo = Math.max(a[i][0], b[j][0])
    const hi = Math.min(a[i][1], b[j][1])
    if (lo < hi) out.push([lo, hi])
    if (a[i][1] < b[j][1]) i++
    else j++
  }
  return out
}

/** The gaps between intervals inside [lo, hi]. */
export function complement(intervals: Interval[], lo: number, hi: number): Interval[] {
  const out: Interval[] = []
  let cursor = lo
  for (const [a, b] of intervals) {
    if (a > cursor) out.push([cursor, a])
    cursor = b
  }
  if (cursor < hi) out.push([cursor, hi])
  return out
}
