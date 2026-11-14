import { beforeAll, describe, expect, it } from 'vitest'
import { compareWithHorizons } from '../../scripts/horizons.ts'
import { loadKernelFiles } from '../../scripts/kernels.ts'
import { intersect, profileHorizon } from './events.ts'
import { assertValidSite, toSky } from './geometry.ts'
import { buildReport, computeViabilityKPI } from './report.ts'
import { createEphemeris, type Ephemeris } from './spice.ts'
import type { Site } from './types.ts'

const site = (id: string, lat: number, lon: number, source = 'test'): Site => ({
  id, name: id, lat, lon, heightKm: 0, source,
})
const IM2 = site('im2', -84.7906, 29.1957, 'NASA LROC')

describe('geometry', () => {
  it('rejects sites without a source or with impossible coordinates', () => {
    expect(() => assertValidSite(site('x', 0, 0, ''))).toThrow()
    expect(() => assertValidSite(site('x', 95, 0))).toThrow()
    expect(() => assertValidSite(site('x', 0, 270))).toThrow()
  })

  it('puts a body over the site at the zenith and one due north on the horizon', () => {
    expect(toSky(site('a', 0, 0), [400000, 0, 0]).el).toBeCloseTo(90, 6)
    const north = toSky(site('a', 0, 0), [1737.4, 0, 1e9])
    expect(north.az).toBeCloseTo(0, 6)
    expect(north.el).toBeCloseTo(0, 3)
    expect(toSky(site('a', 0, 0), [1737.4, 1e9, 0]).az).toBeCloseTo(90, 6)
  })
})

describe('events', () => {
  it('interpolates a terrain profile and wraps around north', () => {
    const h = profileHorizon([0, 4, 0, 0]) // samples at N, E, S, W
    expect(h(90)).toBeCloseTo(4)
    expect(h(45)).toBeCloseTo(2)
    expect(h(315)).toBeCloseTo(0)
    expect(h(450)).toBeCloseTo(4)
    expect(h(-270)).toBeCloseTo(4)
  })

  it('intersects windows', () => {
    expect(intersect([[0, 10], [20, 30]], [[5, 25]])).toEqual([[5, 10], [20, 25]])
    expect(intersect([[0, 1]], [[2, 3]])).toEqual([])
  })
})

describe('SPICE engine', () => {
  let eph: Ephemeris
  beforeAll(async () => {
    eph = await createEphemeris(await loadKernelFiles())
  }, 300_000)

  it('sees the Earth overhead at the near-side centre and hidden on the far side', () => {
    for (const t of ['2026-11-14T00:00', '2026-11-21T00:00', '2026-11-28T00:00']) {
      const et = eph.toEt(t)
      expect(eph.sky(site('near', 0, 0), 'earth', et).el).toBeGreaterThan(80)
      expect(eph.sky(site('far', 0, 180), 'earth', et).el).toBeLessThan(-80)
    }
  })

  it('gives physical distances', () => {
    const et = eph.toEt('2026-11-14T00:00')
    const sun = eph.sky(IM2, 'sun', et).distanceKm
    const earth = eph.sky(IM2, 'earth', et).distanceKm
    expect(sun).toBeGreaterThan(1.45e8)
    expect(sun).toBeLessThan(1.53e8)
    expect(earth).toBeGreaterThan(3.5e5)
    expect(earth).toBeLessThan(4.1e5)
  })

  it('finds rise and set events that are real horizon crossings', () => {
    const r = buildReport(eph, IM2, '2026-11-14', '2026-12-14')
    expect(r.series).toHaveLength(30 * 24 + 1)
    expect(r.events.length).toBeGreaterThan(0)
    for (const e of r.events) {
      // within 1 s of the crossing the body is far less than a millidegree away
      expect(Math.abs(eph.sky(IM2, e.body, eph.toEt(e.t)).el)).toBeLessThan(0.001)
    }
    expect(r.metrics.both_visible_pct).toBeLessThanOrEqual(
      Math.min(r.metrics.sun_visible_pct, r.metrics.earth_visible_pct),
    )
    expect(r.viability).toBeDefined()
    expect(r.viability?.isViable).toBe(true)
    expect(r.viability?.kinematics.orbitalVelocityKmS).toBeCloseTo(1.68, 2)
    expect(r.viability?.kinematics.escapeVelocityKmS).toBeCloseTo(2.376, 2)
  })

  it('loses sunlight behind a terrain horizon and triggers blind-spot veto when comm/orbiter LoS is blocked', () => {
    const smooth = buildReport(eph, IM2, '2026-11-14', '2026-12-14')
    const walled = buildReport(eph, IM2, '2026-11-14', '2026-12-14', {
      horizonProfile: Array(360).fill(3),
    })
    expect(walled.metrics.sun_visible_pct).toBeLessThan(smooth.metrics.sun_visible_pct)
    expect(walled.horizon.type).toBe('terrain')

    const blindCrater = buildReport(
      eph,
      { ...IM2, id: 'blind', orbiterPassElDeg: 11, minCommElevationDeg: 5 },
      '2026-11-14',
      '2026-12-14',
      { horizonProfile: Array(360).fill(12) },
    )
    const kpi = computeViabilityKPI(blindCrater)
    expect(kpi.blindSpotDetected).toBe(true)
    expect(kpi.isViable).toBe(false)
    expect(kpi.verdict).toBe('NO-GO (BLIND SPOT)')
    expect(kpi.scorePct).toBeLessThan(30)
  })

  it('matches NASA/JPL Horizons within a hundredth of a degree (needs internet)', async () => {
    const diff = await compareWithHorizons(eph, IM2, '2026-11-14', '2026-11-17', '8 h')
    for (const d of Object.values(diff)) {
      expect(d.samples).toBeGreaterThanOrEqual(9)
      expect(d.az).toBeLessThan(0.01)
      expect(d.el).toBeLessThan(0.01)
    }
  }, 60_000)
})
