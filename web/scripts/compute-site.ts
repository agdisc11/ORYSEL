/**
 * Compute the SPICE (DE440) report of any point on the Moon and print it as JSON.
 *   npx tsx scripts/compute-site.ts <lat> <lon> [start] [end]
 *
 * Used by POST /api/compute (pruebas/bd-nasa/api.py) for "Coordenadas
 * personalizadas". Latitude -90..90, east longitude -180..180, degrees.
 * The custom point has no measured terrain (smooth horizon) and none of the
 * catalog's model assumptions.
 */
import { buildReport } from '../src/ephemeris/report.ts'
import { createEphemeris } from '../src/ephemeris/spice.ts'
import type { Site } from '../src/ephemeris/types.ts'
import { loadKernelFiles } from './kernels.ts'

const lat = Number(process.argv[2])
const lon = Number(process.argv[3])
if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
  console.error('usage: compute-site.ts <lat -90..90> <lon -180..180>')
  process.exit(2)
}
const start = process.argv[4] ?? '2026-11-14T00:00:00Z'
const end = process.argv[5] ?? '2026-12-14T00:00:00Z'

const site: Site = {
  id: 'custom',
  name: `Coordenadas personalizadas (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`,
  lat,
  lon,
  heightKm: 0,
  source: 'Coordenadas introducidas por el usuario',
  region: 'Punto personalizado · horizonte liso (sin relieve)',
}

const eph = await createEphemeris(await loadKernelFiles())
process.stdout.write(JSON.stringify(buildReport(eph, site, start, end)))
