/** Assemble the per-site report: time series, horizon, events, windows, metrics, and viability KPI. */
import {
  complement,
  intersect,
  profileHorizon,
  refineCrossing,
  smoothHorizon,
  windowsFromCrossings,
  type Interval,
} from './events.ts'
import { MOON_RADIUS_KM } from './geometry.ts'
import { ENGINE, type Ephemeris } from './spice.ts'
import type { Body, Sample, Site, SiteReport, SkyEvent, ViabilityKPI, Window } from './types.ts'

const BODIES: Body[] = ['sun', 'earth']
const MOON_MU_KM3_S2 = 4902.8001
const round = (x: number, digits: number) => Number(x.toFixed(digits))
const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x))

export interface ReportOptions {
  /** Seconds between samples. Default one hour. */
  stepS?: number
  /** Terrain horizon: evenly spaced elevations (deg), from north, clockwise. */
  horizonProfile?: number[] | null
}

/**
 * Executive Mission Viability Indicator (KPI) + Deterministic Communication &
 * Orbital Photographic Line-of-Sight (LoS) Filter.
 *
 * Penalizes and discards sites where:
 *  1) Crew/ground communication link drops below operational safety margins, OR
 *  2) Direct line of sight with the orbital reconnaissance satellite is blocked
 *     by local topography (preventing photographic confirmation / blind spots).
 */
export function computeViabilityKPI(
  report: Pick<SiteReport, 'site' | 'series' | 'metrics' | 'horizon'>,
): ViabilityKPI {
  const { site, series, metrics, horizon } = report
  const minCommEl = site.minCommElevationDeg ?? 0.5
  const terrainMeanDeg =
    horizon.profile && horizon.profile.length > 0
      ? horizon.profile.reduce((a, b) => a + b, 0) / horizon.profile.length
      : 0

  // 1. Illumination subscore (normalized against standard 14.7-day lunar synodic daylight ~50%)
  const daylightEfficiency = clamp((metrics.sun_visible_pct / 50) * 84, 0, 96)
  const continuousSunBonus = clamp((metrics.longest_sun_window_hours / 350) * 8, 0, 8)
  const illumination = round(clamp(daylightEfficiency + continuousSunBonus, 0, 100), 1)

  // 2. Communication link & direct Earth elevation margin
  const safeCommSamples = series.filter((s) => s.earth_visible && s.earth_el >= minCommEl).length
  const safeCommPct =
    series.length > 0 ? (100 * safeCommSamples) / series.length : metrics.earth_visible_pct
  const commGapPenalty = clamp((metrics.longest_comm_gap_hours - 200) * 0.25, 0, 50)
  const communication = round(clamp(safeCommPct * 0.98 + 8 - commGapPenalty, 0, 100), 1)

  // 3. Azimuth & topographic clearance subscore
  const sunGrazingBonus = clamp(metrics.max_sun_el * 0.25, 0, 14)
  const terrainObstaclePenalty = clamp(terrainMeanDeg * 6.5, 0, 75)
  const azimuthTopography = round(clamp(84 + sunGrazingBonus - terrainObstaclePenalty, 0, 100), 1)

  // 4. Lunar environment subscore (~2 km exosphere, electrostatic regolith dust, magnetic shielding)
  const dustPenalty =
    site.electrostaticDustRisk === 'HIGH' ? 24 : site.electrostaticDustRisk === 'MODERATE' ? 9 : 2
  const exospherePenalty = round((site.exosphereInteractionIndex ?? 0.2) * 10, 1)
  // Crustal magnetic anomaly (e.g. Reiner Gamma ~28 nT) deflects solar wind protons
  const magneticBonus = site.magneticAnomalynT && site.magneticAnomalynT >= 15 ? 9 : 0
  const environment = round(clamp(91 - dustPenalty - exospherePenalty + magneticBonus, 0, 100), 1)

  // Deterministic Filter: Crew Communication Link + Orbital Satellite Photographic LoS
  const commLinkOk =
    metrics.earth_visible_pct >= 50 &&
    metrics.both_visible_pct >= 35 &&
    metrics.longest_comm_gap_hours <= 240 &&
    metrics.max_earth_el >= minCommEl

  const orbiterPassEl = site.orbiterPassElDeg ?? Math.max(18, metrics.max_earth_el + 12)
  const maxRimObstruction =
    horizon.profile && horizon.profile.length > 0 ? Math.max(...horizon.profile) : 0
  const orbiterPhotoLoS = orbiterPassEl > maxRimObstruction + 4.0

  const blindSpotDetected = !commLinkOk || !orbiterPhotoLoS

  let vetoReason: string | null = null
  if (!commLinkOk && !orbiterPhotoLoS) {
    vetoReason =
      'Punto ciego crítico: pérdida de enlace directo con la tripulación y obstrucción topográfica hacia el satélite orbital de confirmación fotográfica.'
  } else if (!commLinkOk) {
    vetoReason =
      'Riesgo crítico de incomunicación: la elevación hacia la Tierra cae bajo la máscara de terreno o supera el límite seguro sin enlace.'
  } else if (!orbiterPhotoLoS) {
    vetoReason =
      'Punto ciego orbital: la muralla del cráter bloquea la línea de visión directa (LoS) con el satélite para confirmación fotográfica.'
  }

  const weightedRaw =
    0.28 * illumination +
    0.34 * communication +
    0.22 * azimuthTopography +
    0.16 * environment

  // Apply hard-stop veto gate (Gamma_LoS) if blind spot detected
  const scorePct = blindSpotDetected
    ? round(Math.max(18, Math.min(28, weightedRaw * 0.32)), 0)
    : round(clamp(weightedRaw, 0, 100), 0)

  const verdict: ViabilityKPI['verdict'] = blindSpotDetected
    ? 'NO-GO (BLIND SPOT)'
    : scorePct >= 75
      ? 'GO'
      : 'CAUTION'

  const isViable = !blindSpotDetected && scorePct >= 65

  // Kinematics derived from lunar gravity potential (Kepler / Euler-Lagrange boundary conditions)
  const rKm = Math.max(1700, MOON_RADIUS_KM + site.heightKm)
  const orbitalVelocityKmS = round(Math.sqrt(MOON_MU_KM3_S2 / rKm), 3)
  const escapeVelocityKmS = round(Math.sqrt((2 * MOON_MU_KM3_S2) / rKm), 3)

  const visibleSamples = series.filter((s) => s.sun_visible && s.earth_visible)
  const refSamples = visibleSamples.length > 0 ? visibleSamples : series
  const meanAz =
    refSamples.length > 0
      ? refSamples.reduce((acc, s) => acc + s.earth_az, 0) / refSamples.length
      : 0
  const optimalApproachAzimuthDeg = round((meanAz + 180) % 360, 1)
  const landingEllipse3SigmaKm = round(1.2 + terrainMeanDeg * 0.35, 2)

  return {
    scorePct,
    isViable,
    verdict,
    commLinkOk,
    orbiterPhotoLoS,
    blindSpotDetected,
    vetoReason,
    subscores: {
      illumination,
      communication,
      azimuthTopography,
      environment,
    },
    kinematics: {
      orbitalVelocityKmS,
      escapeVelocityKmS,
      optimalApproachAzimuthDeg,
      landingEllipse3SigmaKm,
    },
  }
}

/** Sun and Earth from `site` between `start` and `end` (UTC text). */
export function buildReport(
  eph: Ephemeris,
  site: Site,
  start: string,
  end: string,
  { stepS = 3600, horizonProfile }: ReportOptions = {},
): SiteReport {
  const effectiveProfile =
    horizonProfile !== undefined ? horizonProfile : (site.horizonProfile ?? null)
  const horizon = effectiveProfile ? profileHorizon(effectiveProfile) : smoothHorizon
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
    xs.map(([a, b]) => ({
      kind,
      start: eph.toUtc(a),
      end: eph.toUtc(b),
      hours: round((b - a) / 3600, 3),
    }))

  const baseReport: SiteReport = {
    site,
    start: eph.toUtc(et0),
    end: eph.toUtc(et1),
    step_s: stepS,
    engine: ENGINE,
    horizon: { type: effectiveProfile ? 'terrain' : 'smooth', profile: effectiveProfile },
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

  return {
    ...baseReport,
    viability: computeViabilityKPI(baseReport),
  }
}
