import type { Site } from '../ephemeris/types.ts'

/**
 * Landing sites. Every coordinate carries its source; a site without a
 * sourced coordinate is not added. (The full catalog is a separate part.)
 */
export const SITES: Site[] = [
  {
    id: 'im2',
    name: 'IM-2 Athena (Mons Mouton)',
    lat: -84.7906,
    lon: 29.1957,
    heightKm: 0,
    source: 'NASA LROC (Lunar Reconnaissance Orbiter Camera)',
  },
]
