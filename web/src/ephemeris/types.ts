/** Shared data contract between the ephemeris engine, AWS telemetry, and the screens. */

export type Body = 'sun' | 'earth'

export type UserProfileMode = 'executive' | 'professional' | 'educational' | 'kids'

/** A point on the Moon. `source` says where the coordinates come from. */
export interface Site {
  id: string
  name: string
  /** Planetocentric latitude, degrees. */
  lat: number
  /** East longitude, -180..180 degrees. */
  lon: number
  /** Height above the 1737.4 km reference sphere, km. */
  heightKm: number
  source: string
  /** Optional geological/mission region tag. */
  region?: string
  /** Optional summary description for the catalog and assistant. */
  description?: string
  /** Optional terrain horizon profile (degrees, evenly spaced from N clockwise). */
  horizonProfile?: number[] | null
  /**
   * Where `horizonProfile` comes from. Anything that is not a measurement must
   * say so (e.g. "supuesto"), and the screens show it as an assumption.
   */
  horizonSource?: string
  /*
   * The fields below are ASSUMPTIONS of the team's viability model, not
   * measurements. The screens label them "Supuesto del modelo".
   */
  /** Minimum elevation angle (deg) required for unobstructed crew/ground comm link. */
  minCommElevationDeg?: number
  /** Elevation angle (deg) of the orbital reconnaissance pass for photographic confirmation. */
  orbiterPassElDeg?: number
  /** Local crustal magnetic anomaly intensity in nanoteslas (e.g. Reiner Gamma ~ 28 nT). */
  magneticAnomalynT?: number
  /** Electrostatic regolith levitation risk during terminator crossings / solar storms. */
  electrostaticDustRisk?: 'LOW' | 'MODERATE' | 'HIGH'
  /** Relative exposure to the lunar exosphere / plasma environment (0..1, model scale). */
  exosphereInteractionIndex?: number
}

export interface SkyPosition {
  /** Degrees from local north, clockwise (east = 90). */
  az: number
  /** Degrees above the local horizontal plane. */
  el: number
  distanceKm: number
}

export interface Sample {
  t: string
  sun_az: number
  sun_el: number
  sun_visible: boolean
  earth_az: number
  earth_el: number
  earth_visible: boolean
}

export interface SkyEvent {
  t: string
  body: Body
  type: 'rise' | 'set'
  az: number
}

export interface Window {
  kind: Body | 'sun_and_earth'
  start: string
  end: string
  hours: number
}

export interface Metrics {
  span_hours: number
  sun_visible_pct: number
  earth_visible_pct: number
  both_visible_pct: number
  longest_sun_window_hours: number
  longest_night_hours: number
  longest_comm_gap_hours: number
  max_sun_el: number
  max_earth_el: number
}

export interface ViabilityKPI {
  /** Executive Mission Viability Indicator (0..100%). */
  scorePct: number
  /** Binary viability flag for gamified/kids mode ("¡Sí se puede!" vs "No se puede"). */
  isViable: boolean
  /** Mission status classification. */
  verdict: 'GO' | 'CAUTION' | 'NO-GO (BLIND SPOT)'
  /** Whether direct communication link with crew/Earth meets safety threshold. */
  commLinkOk: boolean
  /** Whether direct line-of-sight (LoS) with orbital satellite exists for photo confirmation. */
  orbiterPhotoLoS: boolean
  /** True when either crew comm link or orbiter photographic LoS is blocked. */
  blindSpotDetected: boolean
  /** Explanation when vetoed or cautioned. */
  vetoReason: string | null
  subscores: {
    illumination: number
    communication: number
    azimuthTopography: number
    environment: number
  }
  kinematics: {
    orbitalVelocityKmS: number
    escapeVelocityKmS: number
    optimalApproachAzimuthDeg: number
    landingEllipse3SigmaKm: number
  }
}

export interface SiteReport {
  site: Site
  start: string
  end: string
  step_s: number
  engine: string
  horizon: { type: 'smooth' | 'terrain'; profile: number[] | null }
  series: Sample[]
  events: SkyEvent[]
  windows: Window[]
  metrics: Metrics
  viability?: ViabilityKPI
}

/** Horizon elevation (degrees) in the direction of an azimuth (degrees). */
export type Horizon = (azDeg: number) => number
