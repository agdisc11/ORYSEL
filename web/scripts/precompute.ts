/**
 * Compute the report of every site and save it as static JSON for the app.
 *   npx tsx scripts/precompute.ts [start] [end]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SITES } from '../src/data/sites.ts'
import { buildReport } from '../src/ephemeris/report.ts'
import { createEphemeris } from '../src/ephemeris/spice.ts'
import { loadKernelFiles } from './kernels.ts'

const start = process.argv[2] ?? '2026-11-14'
const end = process.argv[3] ?? '2026-12-14'
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data')
mkdirSync(outDir, { recursive: true })

const eph = await createEphemeris(await loadKernelFiles())
for (const site of SITES) {
  const report = buildReport(eph, site, start, end)
  writeFileSync(join(outDir, `${site.id}.json`), JSON.stringify(report))
  const m = report.metrics
  console.log(
    `${site.name}: ${report.series.length} samples, ${report.events.length} events | ` +
      `sunlight ${m.sun_visible_pct}%  Earth ${m.earth_visible_pct}%  both ${m.both_visible_pct}%`,
  )
}
