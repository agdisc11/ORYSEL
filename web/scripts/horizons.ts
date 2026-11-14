/**
 * Independent check against NASA/JPL Horizons (https://ssd.jpl.nasa.gov/horizons/).
 * Horizons is only used to validate the engine; the app never depends on it.
 *   npx tsx scripts/horizons.ts         one month, hourly, for every site
 */
import { fileURLToPath } from 'node:url'
import { SITES } from '../src/data/sites.ts'
import { createEphemeris, type Ephemeris } from '../src/ephemeris/spice.ts'
import type { Body, Site } from '../src/ephemeris/types.ts'
import { loadKernelFiles } from './kernels.ts'

const API = 'https://ssd.jpl.nasa.gov/api/horizons.api'
const HORIZONS_ID: Record<Body, string> = { sun: '10', earth: '399' }

export interface HorizonsRow {
  utc: string
  az: number
  el: number
}

/** Apparent azimuth / elevation of `body` from `site`, straight from Horizons. */
export async function fetchHorizons(
  site: Site,
  body: Body,
  start: string,
  stop: string,
  step: string,
): Promise<HorizonsRow[]> {
  const params = new URLSearchParams({
    format: 'text',
    COMMAND: `'${HORIZONS_ID[body]}'`,
    EPHEM_TYPE: `'OBSERVER'`,
    CENTER: `'coord@301'`,
    COORD_TYPE: `'GEODETIC'`,
    SITE_COORD: `'${site.lon},${site.lat},${site.heightKm}'`,
    START_TIME: `'${start}'`,
    STOP_TIME: `'${stop}'`,
    STEP_SIZE: `'${step}'`,
    QUANTITIES: `'4'`,
    ANG_FORMAT: `'DEG'`,
    CSV_FORMAT: `'YES'`,
  })
  const text = await (await fetch(`${API}?${params}`)).text()
  if (!text.includes('$$SOE')) throw new Error(`Horizons returned no data:\n${text.slice(-600)}`)
  return text
    .split('$$SOE')[1]
    .split('$$EOE')[0]
    .trim()
    .split('\n')
    .map((line) => {
      const cells = line.split(',').map((c) => c.trim())
      return { utc: cells[0], az: Number(cells.at(-3)), el: Number(cells.at(-2)) }
    })
}

/** Largest on-sky azimuth and elevation differences, in degrees. */
export async function compareWithHorizons(
  eph: Ephemeris,
  site: Site,
  start: string,
  stop: string,
  step: string,
): Promise<Record<Body, { az: number; el: number; samples: number }>> {
  const out = {} as Record<Body, { az: number; el: number; samples: number }>
  for (const body of ['sun', 'earth'] as Body[]) {
    const rows = await fetchHorizons(site, body, start, stop, step)
    let az = 0
    let el = 0
    for (const row of rows) {
      const ours = eph.sky(site, body, eph.toEt(row.utc))
      const dAz = Math.abs(((ours.az - row.az + 540) % 360) - 180) * Math.cos((ours.el * Math.PI) / 180)
      az = Math.max(az, dAz)
      el = Math.max(el, Math.abs(ours.el - row.el))
    }
    out[body] = { az, el, samples: rows.length }
  }
  return out
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const eph = await createEphemeris(await loadKernelFiles())
  for (const site of SITES) {
    const diff = await compareWithHorizons(eph, site, '2026-11-14', '2026-12-14', '1 h')
    for (const [body, d] of Object.entries(diff)) {
      console.log(
        `${site.id} ${body.padEnd(5)} ${d.samples} samples  ` +
          `max azimuth diff ${d.az.toExponential(2)} deg  max elevation diff ${d.el.toExponential(2)} deg`,
      )
    }
  }
}
