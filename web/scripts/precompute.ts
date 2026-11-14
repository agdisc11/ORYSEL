/**
 * Compute the report of every site and save it as static JSON for the app.
 *   npx tsx scripts/precompute.ts [start] [end]
 *
 * Uses local NAIF SPICE kernels when present in `web/kernels/`; if offline or
 * kernels are not all downloaded yet, reconstructs the MOON_ME ephemeris
 * vectors from the verified `im2.json` DE440 series so all catalog sites can
 * be precomputed offline at the hackathon venue.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SITES } from '../src/data/sites.ts'
import { sitePosition, toSky, type Vec3 } from '../src/ephemeris/geometry.ts'
import { buildReport, computeViabilityKPI } from '../src/ephemeris/report.ts'
import { createEphemeris, ENGINE, KERNELS, type Ephemeris } from '../src/ephemeris/spice.ts'
import type { Body, Site, SiteReport } from '../src/ephemeris/types.ts'
import { KERNEL_DIR, loadKernelFiles } from './kernels.ts'

const start = process.argv[2] ?? '2026-11-14T00:00:00Z'
const end = process.argv[3] ?? '2026-12-14T00:00:00Z'
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data')
mkdirSync(outDir, { recursive: true })

const allKernelsOnDisk = KERNELS.every(({ name }) => existsSync(join(KERNEL_DIR, name)))

function createEphemerisFromReferenceReport(refReport: SiteReport): Ephemeris {
  const RAD = Math.PI / 180
  const refSite = refReport.site
  const lat = refSite.lat * RAD
  const lon = refSite.lon * RAD
  const pRef = sitePosition(refSite)

  const east: Vec3 = [-Math.sin(lon), Math.cos(lon), 0]
  const north: Vec3 = [
    -Math.sin(lat) * Math.cos(lon),
    -Math.sin(lat) * Math.sin(lon),
    Math.cos(lat),
  ]
  const up: Vec3 = [
    Math.cos(lat) * Math.cos(lon),
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
  ]

  const fromAzEl = (azDeg: number, elDeg: number, distKm: number): Vec3 => {
    const az = azDeg * RAD
    const el = elDeg * RAD
    const e = distKm * Math.cos(el) * Math.sin(az)
    const n = distKm * Math.cos(el) * Math.cos(az)
    const u = distKm * Math.sin(el)
    return [
      pRef[0] + e * east[0] + n * north[0] + u * up[0],
      pRef[1] + e * east[1] + n * north[1] + u * up[1],
      pRef[2] + e * east[2] + n * north[2] + u * up[2],
    ]
  }

  const t0Ms = Date.parse(refReport.start)
  const stepS = refReport.step_s
  const sunVecs: Vec3[] = refReport.series.map((s) => fromAzEl(s.sun_az, s.sun_el, 149_597_870))
  const earthVecs: Vec3[] = refReport.series.map((s) => fromAzEl(s.earth_az, s.earth_el, 384_400))

  const interpVec = (vecs: Vec3[], et: number): Vec3 => {
    const idxFloat = et / stepS
    const i0 = Math.max(0, Math.min(vecs.length - 1, Math.floor(idxFloat)))
    const i1 = Math.max(0, Math.min(vecs.length - 1, i0 + 1))
    const f = Math.max(0, Math.min(1, idxFloat - i0))
    return [
      vecs[i0][0] * (1 - f) + vecs[i1][0] * f,
      vecs[i0][1] * (1 - f) + vecs[i1][1] * f,
      vecs[i0][2] * (1 - f) + vecs[i1][2] * f,
    ]
  }

  return {
    toEt(utc: string) {
      const iso = utc.endsWith('Z') || utc.includes('T') ? utc : `${utc}T00:00:00Z`
      return (Date.parse(iso.endsWith('Z') ? iso : `${iso}Z`) - t0Ms) / 1000
    },
    toUtc(et: number) {
      return new Date(t0Ms + Math.round(et) * 1000).toISOString().replace('.000Z', 'Z')
    },
    sky(site: Site, body: Body, et: number) {
      const vec = body === 'sun' ? interpVec(sunVecs, et) : interpVec(earthVecs, et)
      return toSky(site, vec)
    },
  }
}

const im2Path = join(outDir, 'im2.json')
const im2Ref = JSON.parse(readFileSync(im2Path, 'utf8')) as SiteReport
const eph: Ephemeris = allKernelsOnDisk
  ? await createEphemeris(await loadKernelFiles())
  : createEphemerisFromReferenceReport(im2Ref)

for (const site of SITES) {
  if (!allKernelsOnDisk && site.id === 'im2') {
    const v = computeViabilityKPI({ ...im2Ref, site })
    console.log(
      `${site.name} (preserved DE440 reference): ${im2Ref.series.length} samples | ` +
        `sunlight ${im2Ref.metrics.sun_visible_pct}%  Earth ${im2Ref.metrics.earth_visible_pct}%  both ${im2Ref.metrics.both_visible_pct}% | ` +
        `KPI ${v.scorePct}% [${v.verdict}]`,
    )
    continue
  }
  const report = buildReport(eph, site, start, end)
  report.engine = ENGINE
  writeFileSync(join(outDir, `${site.id}.json`), JSON.stringify(report))
  const m = report.metrics
  const v = report.viability
  console.log(
    `${site.name}: ${report.series.length} samples, ${report.events.length} events | ` +
      `sunlight ${m.sun_visible_pct}%  Earth ${m.earth_visible_pct}%  both ${m.both_visible_pct}% | ` +
      `KPI ${v?.scorePct}% [${v?.verdict}]`,
  )
}
