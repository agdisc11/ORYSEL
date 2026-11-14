import type { Site } from '../ephemeris/types.ts'

/**
 * Landing sites catalog. Every coordinate carries its official NASA source;
 * a site without a sourced coordinate is never added.
 */
export const SITES: Site[] = [
  {
    id: 'im2',
    name: 'IM-2 Athena (Mons Mouton)',
    lat: -84.7906,
    lon: 29.1957,
    heightKm: 0,
    source: 'NASA LROC (Lunar Reconnaissance Orbiter Camera)',
    region: 'Meseta Polar Sur · Misión CLPS IM-2',
    description:
      'Meseta polar a ~5° del polo sur lunar. Presenta iluminación solar rasante (~1° a 6.7°) y línea de visión hacia la Tierra superior al 99% del mes analizado, con riesgo moderado de levitación electrostática de regolito en el terminador.',
    minCommElevationDeg: 0.5,
    orbiterPassElDeg: 42,
    magneticAnomalynT: 2,
    electrostaticDustRisk: 'MODERATE',
    exosphereInteractionIndex: 0.25,
    spaceEnginePreset: {
      sceneName: '1-IM2-MonsMouton-Cielo',
      utcInstant: '2026-11-22T14:00:00Z',
      cameraNote:
        'Cámara en superficie de Mons Mouton (84.79°S, 29.20°E): Sol rasante a 6.70° (Az 352.9°) y Tierra visible a 10.02° sobre el horizonte (Az 324.6°).',
    },
  },
  {
    id: 'reiner-gamma',
    name: 'Reiner Gamma (Anomalía Magnética)',
    lat: 7.48,
    lon: -59.05,
    heightKm: -1.2,
    source: 'NASA LROC NAC · Reiner Gamma Lunar Swirl (7.48°N, 59.05°W)',
    region: 'Oceanus Procellarum · Remolino Lunar Ecuatorial',
    description:
      'Sitio insignia de alta viabilidad: anomalía magnética cortical local (~28 nT) que deflecta parcialmente el viento solar, topografía llana sin obstrucciones, enlace continuo con la Tierra (elevación ~30°) y línea de visión limpia con el orbitador para confirmación fotográfica.',
    minCommElevationDeg: 10.0,
    orbiterPassElDeg: 78,
    magneticAnomalynT: 28,
    electrostaticDustRisk: 'LOW',
    exosphereInteractionIndex: 0.14,
    spaceEnginePreset: {
      sceneName: '2-ReinerGamma-Contraste3D',
      utcInstant: '2026-11-20T12:00:00Z',
      cameraNote:
        'Contraste visual 3D sobre el remolino de alto albedo en Reiner Gamma: Tierra alta en el cielo (sin riesgo de ocultación por relieve) y geometría ideal para confirmación fotográfica orbital.',
    },
  },
  {
    id: 'shackleton-blindspot',
    name: 'Cráter Shackleton Interior (Punto Ciego)',
    lat: -89.68,
    lon: 125.0,
    heightKm: -3.8,
    source: 'NASA LOLA / LROC · Shackleton Crater Interior Rim (-89.68°S, 125.0°E)',
    region: 'Depresión Polar Sur · Caso de Descarte por Punto Ciego',
    description:
      'Interior escarpado rodeado por murallas topográficas de 4.2 km (máscara de horizonte de 9° a 12°). Demuestra el filtro determinante de ORYSEL: bloquea el enlace directo con la tripulación y obstruye la línea de visión con el satélite orbital para confirmación fotográfica.',
    horizonProfile: [
      10, 11, 12, 11, 10, 9, 9, 10, 11, 12, 12, 11, 10, 9, 8, 9, 10, 11,
      12, 11, 10, 9, 9, 10, 11, 12, 12, 11, 11, 10, 10, 11, 12, 12, 11, 10,
    ],
    minCommElevationDeg: 5.0,
    orbiterPassElDeg: 11,
    magneticAnomalynT: 1,
    electrostaticDustRisk: 'HIGH',
    exosphereInteractionIndex: 0.48,
    spaceEnginePreset: {
      sceneName: '3-Shackleton-Ocultacion-PuntoCiego',
      utcInstant: '2026-11-18T00:00:00Z',
      cameraNote:
        'Validación de descarte: la muralla del cráter de ~11° de elevación oculta por completo la Tierra y deja la misión en silencio de radio y punto ciego fotográfico.',
    },
  },
  {
    id: 'apollo11',
    name: 'Mare Tranquillitatis (Base Eagle Apollo 11)',
    lat: 0.6741,
    lon: 23.473,
    heightKm: -1.9,
    source: 'NASA LROC · Apollo 11 Lunar Module Eagle (0.6741°N, 23.4730°E)',
    region: 'Llanura Ecuatorial · Referencia Histórica',
    description:
      'Sitio histórico de validación con horizonte despejado, enlace directo permanente con la Tierra a más de 60° de elevación y confirmación fotográfica orbital verificada por LROC.',
    minCommElevationDeg: 12.0,
    orbiterPassElDeg: 84,
    magneticAnomalynT: 4,
    electrostaticDustRisk: 'LOW',
    exosphereInteractionIndex: 0.18,
    spaceEnginePreset: {
      sceneName: '4-Apollo11-Benchmark',
      utcInstant: '2026-11-19T16:00:00Z',
      cameraNote:
        'Punto de control ecuatorial: Tierra casi cenital (~64° de elevación) y ciclo solar diurno clásico de 14.7 días.',
    },
  },
]
