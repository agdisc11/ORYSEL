/** Shared data contract between the ephemeris engine and the screens. */

export type Body = 'sun' | 'earth'

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
}

/** Horizon elevation (degrees) in the direction of an azimuth (degrees). */
export type Horizon = (azDeg: number) => number
