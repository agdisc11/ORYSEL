/**
 * Compute the report of every site with NASA/NAIF SPICE (DE440) and save it as
 * JSON in web/data/, which the API serves to signed-in users (/api/reports).
 *   npx tsx scripts/precompute.ts [start] [end]
 *
 * Always uses the real kernels (downloaded and checked by scripts/kernels.ts).
 * There is no approximate fallback: a report that says "SPICE DE440" must be
 * computed with SPICE DE440.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SITES } from '../src/data/sites.ts'
import { buildReport } from '../src/ephemeris/report.ts'
import { createEphemeris } from '../src/ephemeris/spice.ts'
import { loadKernelFiles } from './kernels.ts'

const start = process.argv[2] ?? '2026-11-14T00:00:00Z'
const end = process.argv[3] ?? '2026-12-14T00:00:00Z'
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data')
mkdirSync(outDir, { recursive: true })

const eph = await createEphemeris(await loadKernelFiles())
for (const site of SITES) {
  const report = buildReport(eph, site, start, end)
  writeFileSync(join(outDir, `${site.id}.json`), JSON.stringify(report))
  const m = report.metrics
  const v = report.viability
  console.log(
    `${site.name}: ${report.series.length} samples, ${report.events.length} events | ` +
      `sunlight ${m.sun_visible_pct}%  Earth ${m.earth_visible_pct}%  both ${m.both_visible_pct}% | ` +
      `KPI ${v?.scorePct}% [${v?.verdict}]`,
  )
}
