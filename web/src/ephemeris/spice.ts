/**
 * NASA/NAIF SPICE in JavaScript (CSPICE compiled to asm.js by NASA-AMMOS,
 * package `timecraftjs`). Works the same in the browser and in Node.
 *
 * Kernels (all NASA open data, https://naif.jpl.nasa.gov/naif/data_generic.html):
 * leap seconds, lunar orientation DE440, lunar frames and the DE440 ephemeris.
 */
import { ASM_SPICE_FULL, Spice } from 'timecraftjs'
import { assertValidSite, toSky, type Vec3 } from './geometry.ts'
import type { Body, Site, SkyPosition } from './types.ts'

const NAIF = 'https://naif.jpl.nasa.gov/pub/naif/generic_kernels'

export const KERNELS = [
  { name: 'naif0012.tls', url: `${NAIF}/lsk/naif0012.tls`, provides: 'leap seconds' },
  { name: 'pck00011.tpc', url: `${NAIF}/pck/pck00011.tpc`, provides: 'body constants' },
  {
    name: 'moon_pa_de440_200625.bpc',
    url: `${NAIF}/pck/moon_pa_de440_200625.bpc`,
    provides: 'high-accuracy lunar orientation (DE440)',
  },
  {
    name: 'moon_de440_250416.tf',
    url: `${NAIF}/fk/satellites/moon_de440_250416.tf`,
    provides: 'lunar frames MOON_PA / MOON_ME',
  },
  { name: 'de440s.bsp', url: `${NAIF}/spk/planets/de440s.bsp`, provides: 'planetary ephemeris DE440' },
] as const

export const ENGINE = 'SPICE (NASA/NAIF) with DE440; frame MOON_ME; LT+S'

const TARGET: Record<Body, string> = { sun: 'SUN', earth: 'EARTH' }

/** Loaded SPICE toolkit plus the few calls this project needs. */
export interface Ephemeris {
  /** UTC text (ISO or any format SPICE accepts) -> ephemeris seconds past J2000. */
  toEt(utc: string): number
  /** Ephemeris time -> 'YYYY-MM-DDTHH:MM:SSZ'. */
  toUtc(et: number): string
  /** Apparent direction of the Sun or the Earth from a surface site. */
  sky(site: Site, body: Body, et: number): SkyPosition
}

/**
 * Start SPICE and load the kernels. `kernels` holds the file contents in the
 * order of `KERNELS` (fetched in the browser, read from disk in Node).
 */
export async function createEphemeris(kernels: ArrayBuffer[]): Promise<Ephemeris> {
  const spice = await new Spice().init(ASM_SPICE_FULL)
  spice.erract('SET', 'RETURN')
  for (const buffer of kernels) spice.loadKernel(buffer)

  const check = () => {
    if (spice.failed()) {
      const message = spice.getmsg('LONG')
      spice.reset()
      throw new Error(`SPICE: ${message}`)
    }
  }

  return {
    toEt(utc) {
      const et = spice.str2et(utc.replace(/Z$/, ''))
      check()
      return et
    },
    toUtc(et) {
      const utc = spice.et2utc(et, 'ISOC', 0)
      check()
      return `${utc}Z`
    },
    sky(site, body, et) {
      assertValidSite(site)
      // Body relative to the Moon centre, in the Moon-fixed frame, corrected
      // for light time and stellar aberration. The site offset (1737 km) is
      // then removed by `toSky`; applying the corrections at the Moon centre
      // instead of at the site changes the direction by far less than 1e-5 deg.
      const { ptarg } = spice.spkpos(TARGET[body], et, 'MOON_ME', 'LT+S', 'MOON')
      check()
      return toSky(site, ptarg as Vec3)
    },
  }
}
