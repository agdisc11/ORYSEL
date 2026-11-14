/** Assemble the per-site report: time series, horizon, events, windows, metrics. */
import {
  complement,
  intersect,
  profileHorizon,
  refineCrossing,
  smoothHorizon,
  windowsFromCrossings,
  type Interval,
} from './events.ts'
import { ENGINE, type Ephemeris } from './spice.ts'
import type { Body, Sample, Site, SiteReport, SkyEvent, Window } from './types.ts'

const BODIES: Body[] = ['sun', 'earth']
const round = (x: number, digits: number) => Number(x.toFixed(digits))

export interface ReportOptions {
  /** Seconds between samples. Default one hour. */
  stepS?: number
  /** Terrain horizon: evenly spaced elevations (deg), from north, clockwise. */
  horizonProfile?: number[] | null
}

/** Sun and Earth from `site` between `start` and `end` (UTC text). */
export function buildReport(
  eph: Ephemeris,
  site: Site,
  start: string,
  end: string,
  { stepS = 3600, horizonProfile = null }: ReportOptions = {},
): SiteReport {
  const horizon = horizonProfile ? profileHorizon(horizonProfile) : smoothHorizon
  const et0 = eph.toEt(start)
  const et1 = eph.toEt(end)
  if (!(et1 > et0) || !(stepS > 0)) throw new Error('end must be after start and step positive')

  const n = Math.floor((et1 - et0) / stepS + 1e-9)
  const times = Array.from({ length: n + 1 }, (_, i) => et0 + i * stepS)
  if (et1 - times[times.length - 1] > 1e-3) times.push(et1)

  const margin = (body: Body) => (et: number) => {
    const p = eph.sky(site, body, et)
    return p.el - horizon(p.az)
  }

  const visible: Record<Body, boolean[]> = { sun: [], earth: [] }
  const series: Sample[] = times.map((et) => {
    const sun = eph.sky(site, 'sun', et)
    const earth = eph.sky(site, 'earth', et)
    visible.sun.push(sun.el - horizon(sun.az) > 0)
    visible.earth.push(earth.el - horizon(earth.az) > 0)
    return {
      t: eph.toUtc(et),
      sun_az: round(sun.az, 4),
      sun_el: round(sun.el, 4),
      sun_visible: visible.sun[visible.sun.length - 1],
      earth_az: round(earth.az, 4),
      earth_el: round(earth.el, 4),
      earth_visible: visible.earth[visible.earth.length - 1],
    }
  })

  const timed: (SkyEvent & { et: number })[] = []
  const intervals = {} as Record<Body, Interval[]>
  for (const body of BODIES) {
    const crossings: (SkyEvent & { et: number })[] = []
    for (let i = 1; i < times.length; i++) {
      if (visible[body][i] === visible[body][i - 1]) continue
      const et = refineCrossing(margin(body), times[i - 1], times[i])
      crossings.push({
        et,
        t: eph.toUtc(et),
        body,
        type: visible[body][i] ? 'rise' : 'set',
        az: round(eph.sky(site, body, et).az, 3),
      })
    }
    intervals[body] = windowsFromCrossings(crossings, et0, et1, visible[body][0])
    timed.push(...crossings)
  }
  timed.sort((a, b) => a.et - b.et)
  const both = intersect(intervals.sun, intervals.earth)

  const span = et1 - et0
  const total = (xs: Interval[]) => xs.reduce((s, [a, b]) => s + (b - a), 0)
  const longestH = (xs: Interval[]) => Math.max(0, ...xs.map(([a, b]) => b - a)) / 3600
  const asWindows = (kind: Window['kind'], xs: Interval[]): Window[] =>
    xs.map(([a, b]) => ({ kind, start: eph.toUtc(a), end: eph.toUtc(b), hours: round((b - a) / 3600, 3) }))

  return {
    site,
    start: eph.toUtc(et0),
    end: eph.toUtc(et1),
    step_s: stepS,
    engine: ENGINE,
    horizon: { type: horizonProfile ? 'terrain' : 'smooth', profile: horizonProfile },
    series,
    events: timed.map(({ t, body, type, az }) => ({ t, body, type, az })),
    windows: [
      ...asWindows('sun', intervals.sun),
      ...asWindows('earth', intervals.earth),
      ...asWindows('sun_and_earth', both),
    ],
    metrics: {
      span_hours: round(span / 3600, 3),
      sun_visible_pct: round((100 * total(intervals.sun)) / span, 2),
      earth_visible_pct: round((100 * total(intervals.earth)) / span, 2),
      both_visible_pct: round((100 * total(both)) / span, 2),
      longest_sun_window_hours: round(longestH(intervals.sun), 2),
      longest_night_hours: round(longestH(complement(intervals.sun, et0, et1)), 2),
      longest_comm_gap_hours: round(longestH(complement(intervals.earth, et0, et1)), 2),
      max_sun_el: Math.max(...series.map((r) => r.sun_el)),
      max_earth_el: Math.max(...series.map((r) => r.earth_el)),
    },
  }
}
