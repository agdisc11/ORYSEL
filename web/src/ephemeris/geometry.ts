/**
 * Pure geometry: from a body position in the Moon-fixed frame to azimuth and
 * elevation in the sky of a surface site. No SPICE calls here.
 *
 * Conventions used by the whole project:
 *  - frame MOON_ME (mean Earth / polar axis), the one used by LRO products
 *  - planetocentric latitude, east longitude in -180..180 degrees
 *  - reference sphere of radius 1737.4 km
 *  - azimuth from local north, clockwise; elevation above the horizontal plane
 */
import type { Site, SkyPosition } from './types.ts'

export const MOON_RADIUS_KM = 1737.4
export type Vec3 = [number, number, number]

const RAD = Math.PI / 180

export function assertValidSite(site: Site): void {
  if (!(site.lat >= -90 && site.lat <= 90) || !(site.lon >= -180 && site.lon <= 180)) {
    throw new Error('lat must be in -90..90 and lon in -180..180 (east positive)')
  }
  if (!site.source) throw new Error('every coordinate needs a source')
}

/** Site position in MOON_ME, km. */
export function sitePosition(site: Site): Vec3 {
  const r = MOON_RADIUS_KM + site.heightKm
  const lat = site.lat * RAD
  const lon = site.lon * RAD
  return [r * Math.cos(lat) * Math.cos(lon), r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat)]
}

/**
 * Azimuth / elevation of a body whose position relative to the Moon centre,
 * in MOON_ME, is `bodyKm`.
 */
export function toSky(site: Site, bodyKm: Vec3): SkyPosition {
  const lat = site.lat * RAD
  const lon = site.lon * RAD
  const p = sitePosition(site)
  const d: Vec3 = [bodyKm[0] - p[0], bodyKm[1] - p[1], bodyKm[2] - p[2]]

  // Local east, north, up unit vectors at the site.
  const east: Vec3 = [-Math.sin(lon), Math.cos(lon), 0]
  const north: Vec3 = [-Math.sin(lat) * Math.cos(lon), -Math.sin(lat) * Math.sin(lon), Math.cos(lat)]
  const up: Vec3 = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)]

  const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  const e = dot(d, east)
  const n = dot(d, north)
  const u = dot(d, up)
  const distanceKm = Math.hypot(e, n, u)

  return {
    az: ((Math.atan2(e, n) / RAD) % 360 + 360) % 360,
    el: Math.asin(u / distanceKm) / RAD,
    distanceKm,
  }
}
