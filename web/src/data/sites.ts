import type { Site } from '../ephemeris/types.ts'

/**
 * Landing sites. Every coordinate carries its source; a site without a
 * sourced coordinate is never added.
 *
 * Heights are 0 km: no measured elevation is used yet, so every site sits on
 * the 1737.4 km reference sphere (the project convention).
 *
 * minCommElevationDeg, orbiterPassElDeg, magneticAnomalynT,
 * electrostaticDustRisk and exosphereInteractionIndex are ASSUMPTIONS of the
 * team's viability model (shown as "Supuesto del modelo"), not measurements.
 */
export const SITES: Site[] = [
  {
    id: 'im2',
    name: 'IM-2 Athena (Mons Mouton)',
    lat: -84.7906,
    lon: 29.1957,
    heightKm: 0,
    source: 'NASA LROC (Lunar Reconnaissance Orbiter Camera)',
    region: 'Meseta polar sur · Misión CLPS IM-2',
    description:
      'Meseta de Mons Mouton, a unos 5° del polo sur, donde alunizó IM-2 en marzo de 2025. El Sol y la Tierra se mueven siempre cerca del horizonte, así que unos pocos grados de relieve cambian la luz y la comunicación.',
    minCommElevationDeg: 0.5,
    orbiterPassElDeg: 42,
    magneticAnomalynT: 2,
    electrostaticDustRisk: 'MODERATE',
    exosphereInteractionIndex: 0.25,
  },
  {
    id: 'reiner-gamma',
    name: 'Reiner Gamma (Anomalía Magnética)',
    lat: 7.39,
    lon: -58.96,
    heightKm: 0,
    source: 'IAU/USGS Gazetteer of Planetary Nomenclature · Reiner Gamma (Feature 4987)',
    region: 'Oceanus Procellarum · Remolino lunar',
    description:
      'Remolino lunar (swirl) de alto albedo en Oceanus Procellarum, asociado a una anomalía magnética de la corteza. Está en la cara visible, así que la Tierra nunca se oculta; el Sol sigue el ciclo de unos 15 días de luz y 15 de noche.',
    minCommElevationDeg: 10.0,
    orbiterPassElDeg: 78,
    magneticAnomalynT: 28,
    electrostaticDustRisk: 'LOW',
    exosphereInteractionIndex: 0.14,
  },
  {
    id: 'shackleton-blindspot',
    name: 'Cráter Shackleton (escenario hipotético)',
    lat: -89.67,
    lon: 129.78,
    heightKm: 0,
    source:
      'IAU/USGS Gazetteer of Planetary Nomenclature · Shackleton (Feature 5450), centro del cráter',
    region: 'Polo sur · Caso de prueba del filtro de punto ciego',
    description:
      'Centro del cráter Shackleton (21 km de diámetro), junto al polo sur. El horizonte de este sitio es un supuesto (paredes de 8° a 12°), todavía no medido con LOLA: sirve para mostrar cómo el filtro descarta un sitio cuando el relieve tapa el Sol y la Tierra.',
    horizonProfile: [
      10, 11, 12, 11, 10, 9, 9, 10, 11, 12, 12, 11, 10, 9, 8, 9, 10, 11, 12, 11, 10, 9, 9, 10, 11,
      12, 12, 11, 11, 10, 10, 11, 12, 12, 11, 10,
    ],
    horizonSource: 'supuesto',
    minCommElevationDeg: 5.0,
    orbiterPassElDeg: 11,
    magneticAnomalynT: 1,
    electrostaticDustRisk: 'HIGH',
    exosphereInteractionIndex: 0.48,
  },
  {
    id: 'apollo11',
    name: 'Mare Tranquillitatis (Base Eagle Apollo 11)',
    lat: 0.6741,
    lon: 23.473,
    heightKm: 0,
    source: 'NASA LROC · Apollo 11 Lunar Module Eagle (0.6741°N, 23.4730°E)',
    region: 'Llanura ecuatorial · Referencia histórica',
    description:
      'Sitio del alunizaje del Apolo 11 (1969) en el Mar de la Tranquilidad, cerca del ecuador. La Tierra está siempre alta en el cielo y el Sol sigue el ciclo de unos 15 días de luz y 15 de noche.',
    minCommElevationDeg: 12.0,
    orbiterPassElDeg: 84,
    magneticAnomalynT: 4,
    electrostaticDustRisk: 'LOW',
    exosphereInteractionIndex: 0.18,
  },
]

/** English text for the catalog (the Spanish text above is the original). */
const SITES_EN: Record<string, Pick<Site, 'name' | 'region' | 'description'>> = {
  im2: {
    name: 'IM-2 Athena (Mons Mouton)',
    region: 'South polar plateau · CLPS IM-2 mission',
    description:
      'Mons Mouton plateau, about 5° from the south pole, where IM-2 landed in March 2025. The Sun and Earth always move close to the horizon, so a few degrees of terrain change light and communication.',
  },
  'reiner-gamma': {
    name: 'Reiner Gamma (Magnetic Anomaly)',
    region: 'Oceanus Procellarum · Lunar swirl',
    description:
      'High-albedo lunar swirl in Oceanus Procellarum, linked to a magnetic anomaly in the crust. It is on the near side, so Earth never sets; the Sun follows a cycle of about 15 days of light and 15 of night.',
  },
  'shackleton-blindspot': {
    name: 'Shackleton Crater (hypothetical scenario)',
    region: 'South pole · Blind-spot filter test case',
    description:
      'Centre of Shackleton crater (21 km wide), next to the south pole. The horizon of this site is an assumption (walls of 8° to 12°), not yet measured with LOLA: it shows how the filter rules out a site when terrain hides the Sun and Earth.',
  },
  apollo11: {
    name: 'Mare Tranquillitatis (Apollo 11 Eagle base)',
    region: 'Equatorial plain · Historical reference',
    description:
      'Apollo 11 landing site (1969) in the Sea of Tranquility, near the equator. Earth is always high in the sky and the Sun follows a cycle of about 15 days of light and 15 of night.',
  },
}

/** Site text in the chosen language; coordinates and data are never changed. */
export function localizeSite<T extends Site>(site: T, lang: 'es' | 'en'): T {
  const base = SITES.find((s) => s.id === site.id)
  if (!base) {
    // Custom point: only the label changes
    const m = /\(([-\d.]+°, [-\d.]+°)\)/.exec(site.name)
    if (!m) return site
    return {
      ...site,
      name: lang === 'es' ? `Coordenadas personalizadas (${m[1]})` : `Custom point (${m[1]})`,
      region:
        lang === 'es'
          ? 'Punto personalizado · horizonte liso (sin relieve)'
          : 'Custom point · smooth horizon (no terrain)',
    }
  }
  const text =
    lang === 'es'
      ? { name: base.name, region: base.region, description: base.description }
      : SITES_EN[site.id]
  return text ? { ...site, ...text } : site
}
