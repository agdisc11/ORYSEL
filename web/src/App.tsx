import { useEffect, useMemo, useState } from 'react'
import { ArchitectureDefensePanel } from './components/ArchitectureDefensePanel.tsx'
import { ElevationChart } from './components/ElevationChart.tsx'
import { OnboardingModal, type UserSession } from './components/OnboardingModal.tsx'
import { OryBotAssistant } from './components/OryBotAssistant.tsx'
import { RocketVectorPlayground } from './components/RocketVectorPlayground.tsx'
import { SITES } from './data/sites.ts'
import { computeViabilityKPI } from './ephemeris/report.ts'
import type { SiteReport, UserProfileMode } from './ephemeris/types.ts'

const fmt = (iso: string) => iso.replace('T', ' ').replace(':00Z', ' UTC').replace('Z', ' UTC')
const LABEL = { sun: 'Sol', earth: 'Tierra' } as const

export default function App() {
  const [selectedSiteId, setSelectedSiteId] = useState<string>(SITES[0].id)
  const [profile, setProfile] = useState<UserProfileMode>('professional')
  const [session, setSession] = useState<UserSession>({
    name: 'Cmdr. ORYSEL',
    organization: 'NASA Space Apps · Tuxtla Gutiérrez',
    profile: 'professional',
  })
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false)
  const [rawReport, setRawReport] = useState<SiteReport | null>(null)
  const [selectedSampleIdx, setSelectedSampleIdx] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)

  const site = useMemo(
    () => SITES.find((s) => s.id === selectedSiteId) ?? SITES[0],
    [selectedSiteId],
  )

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/${site.id}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((loaded: SiteReport) => {
        setError(null)
        setRawReport(loaded)
        setSelectedSampleIdx(Math.min(180, Math.max(0, Math.floor(loaded.series.length / 4))))
      })
      .catch((e: Error) => setError(e.message))
  }, [site.id])

  const report = useMemo<SiteReport | null>(() => {
    if (!rawReport) return null
    const mergedSite = { ...rawReport.site, ...site }
    const enriched: SiteReport = {
      ...rawReport,
      site: mergedSite,
      horizon:
        site.horizonProfile && site.horizonProfile.length > 0
          ? { type: 'terrain', profile: site.horizonProfile }
          : rawReport.horizon,
    }
    return {
      ...enriched,
      viability: computeViabilityKPI(enriched),
    }
  }, [rawReport, site])

  const viability = report?.viability
  const activeSample =
    report && report.series.length > 0
      ? (report.series[selectedSampleIdx] ?? report.series[0])
      : null

  return (
    <main>
      {/* BLOQUE DE APERTURA (GANCHO DE 5 A 10 SEGUNDOS) */}
      <section className="pitch-hero" aria-label="Propuesta de valor de ORYSEL">
        <div className="pitch-hero-top">
          <p className="eyebrow">
            ORYSEL · NASA Space Apps 2026 · Plataforma de Inteligencia y Viabilidad Orbital Lunar
          </p>
          <div className="user-bar">
            <span className="user-pill">
              👤 {session.name} <small>({session.organization})</small>
            </span>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowOnboarding(true)}
            >
              Paso 1: Registro / Cuenta
            </button>
          </div>
        </div>

        <h1 className="hero-headline">
          Predice dónde, cuándo y con qué probabilidad de éxito puede alunizar y comunicarse una
          misión antes de lanzar un solo kilogramo al espacio.
        </h1>
        <p className="hero-sub">
          Impulsado por nuestro <strong>Kernel Físico SPICE/DE440 (`src/ephemeris/`)</strong> y
          validado contra <strong>NASA JPL Horizons</strong> (error &lt; 0.00003°), con filtro
          determinante de enlace hacia la tripulación y línea de visión fotográfica satelital.
        </p>

        {/* TRIPLE SEGMENTACIÓN DE LA INTERFAZ */}
        <div className="segment-tabs" role="tablist" aria-label="Segmentación de interfaz por perfil">
          <button
            type="button"
            role="tab"
            aria-selected={profile === 'professional'}
            className={`seg-tab ${profile === 'professional' ? 'active' : ''}`}
            onClick={() => setProfile('professional')}
          >
            <strong>Vista Profesional (NASA)</strong>
            <span>Mecánica orbital, acimut, velocidades y telemetría</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={profile === 'educational'}
            className={`seg-tab ${profile === 'educational' ? 'active' : ''}`}
            onClick={() => setProfile('educational')}
          >
            <strong>Vista Educativa</strong>
            <span>Explicación visual e interactiva sin saturación matemática</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={profile === 'kids'}
            className={`seg-tab ${profile === 'kids' ? 'active' : ''}`}
            onClick={() => setProfile('kids')}
          >
            <strong>Vista Infantil / Gamificada</strong>
            <span>Veredicto "¡Sí se puede!" + Vectores en cohete</span>
          </button>
        </div>
      </section>

      {showOnboarding && (
        <OnboardingModal
          session={session}
          onComplete={(nextSession) => {
            setSession(nextSession)
            setProfile(nextSession.profile)
            setShowOnboarding(false)
          }}
          onClose={() => setShowOnboarding(false)}
        />
      )}

      {/* PASO 2 DEL USER JOURNEY: EXPLORACIÓN DE SITIOS RECOMENDADOS */}
      <section className="site-selector-section" aria-label="Exploración de sitios lunares recomendados">
        <div className="section-header-inline">
          <span className="pill-badge">PASO 2 · CATÁLOGO DE SITIOS RECOMENDADOS (`sites.ts`)</span>
          <span className="muted">
            Selecciona un sitio para calcular su KPI de Viabilidad y verificar puntos ciegos
          </span>
        </div>
        <div className="site-cards-grid">
          {SITES.map((item) => {
            const isSelected = item.id === site.id
            const isBlindSpot = item.id === 'shackleton-blindspot'
            return (
              <button
                key={item.id}
                type="button"
                className={`site-card ${isSelected ? 'selected' : ''} ${isBlindSpot ? 'blindspot-card' : ''}`}
                onClick={() => setSelectedSiteId(item.id)}
              >
                <div className="site-card-top">
                  <strong>{item.name}</strong>
                  <span className={`tag-mini ${isBlindSpot ? 'danger' : 'ok'}`}>
                    {isBlindSpot ? 'Punto Ciego' : item.id === 'reiner-gamma' ? '28 nT Swirl' : 'Validado'}
                  </span>
                </div>
                <span className="site-coords mono">
                  {Math.abs(item.lat).toFixed(2)}° {item.lat < 0 ? 'S' : 'N'},{' '}
                  {Math.abs(item.lon).toFixed(2)}° {item.lon < 0 ? 'W' : 'E'} · {item.region}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {error && <p className="error">No se pudieron cargar las efemérides del sitio: {error}</p>}
      {!report && !error && <p className="muted">Calculando efemérides SPICE DE440…</p>}

      {report && viability && activeSample && (
        <>
          {/* PASO 3 DEL USER JOURNEY: ASISTENTE VIRTUAL "ROBOTITO" (ORY-BOT) */}
          <OryBotAssistant
            site={site}
            viability={viability}
            profile={profile}
            activeSample={activeSample}
            userName={session.name}
            onSelectSiteId={setSelectedSiteId}
          />

          {/* PANEL EJECUTIVO DEL KPI DE VIABILIDAD + FILTRO DETERMINANTE DE COMUNICACIÓN Y VISIBILIDAD */}
          <section
            className={`kpi-executive-panel ${viability.blindSpotDetected ? 'vetoed' : 'viable'}`}
            aria-label="Indicador de Viabilidad de la Misión (KPI)"
          >
            <div className="kpi-score-box">
              <span className="pill-badge">INDICADOR DE VIABILIDAD DE LA MISIÓN (KPI)</span>
              {profile === 'kids' ? (
                <strong className="kpi-giant-binary">
                  {viability.isViable ? '¡SÍ SE PUEDE!' : '¡NO SE PUEDE!'}
                </strong>
              ) : (
                <div className="kpi-number-row">
                  <strong className="kpi-giant-number">{viability.scorePct}%</strong>
                  <span className={`verdict-pill ${viability.blindSpotDetected ? 'nogo' : 'go'}`}>
                    {viability.verdict}
                  </span>
                </div>
              )}
              <span className="muted">
                {site.name} · Fuente: {site.source}
              </span>
            </div>

            <div className="kpi-filters-box">
              <div className={`filter-check ${viability.commLinkOk ? 'pass' : 'fail'}`}>
                <span className="status-icon">{viability.commLinkOk ? '✓' : '✕'}</span>
                <div>
                  <strong>Enlace Directo con Tripulación (Tierra)</strong>
                  <small>
                    {viability.commLinkOk
                      ? `${report.metrics.earth_visible_pct}% de ventana con línea de vista directa`
                      : 'Fallo crítico: pérdida de enlace por ocultación topográfica'}
                  </small>
                </div>
              </div>

              <div className={`filter-check ${viability.orbiterPhotoLoS ? 'pass' : 'fail'}`}>
                <span className="status-icon">{viability.orbiterPhotoLoS ? '✓' : '✕'}</span>
                <div>
                  <strong>Línea de Visión Satélite Orbital (Confirmación Fotográfica)</strong>
                  <small>
                    {viability.orbiterPhotoLoS
                      ? `Elevación de pase orbital (${site.orbiterPassElDeg ?? 45}°) libre de puntos ciegos`
                      : 'Punto ciego detectado: muralla del cráter bloquea cámara orbital'}
                  </small>
                </div>
              </div>

              {viability.vetoReason && (
                <p className="veto-alert-box">
                  <strong>FILTRO DETERMINANTE ACTIVADO:</strong> {viability.vetoReason}
                </p>
              )}
            </div>

            {profile !== 'kids' && (
              <div className="kpi-subscores">
                <div>
                  <span>Iluminación Solar</span>
                  <strong className="mono">{viability.subscores.illumination}%</strong>
                </div>
                <div>
                  <span>Enlace y Telemetría</span>
                  <strong className="mono">{viability.subscores.communication}%</strong>
                </div>
                <div>
                  <span>Acimut / Topografía</span>
                  <strong className="mono">{viability.subscores.azimuthTopography}%</strong>
                </div>
                <div>
                  <span>Ambiente Lunar</span>
                  <strong className="mono">{viability.subscores.environment}%</strong>
                </div>
              </div>
            )}
          </section>

          {/* CONTENIDO ESPECÍFICO SEGÚN PERFIL ACTIVO */}
          {profile === 'kids' && <RocketVectorPlayground site={site} viability={viability} />}

          {profile === 'educational' && (
            <section className="edu-cards-grid" aria-label="Guía educativa interactiva">
              <div className="edu-card">
                <span className="pill-badge">CONCEPTO 1 · ACIMUT Y ELEVACIÓN</span>
                <h3>¿Cómo ubicamos el Sol y la Tierra desde la Luna?</h3>
                <p>
                  El <strong>Acimut (0° a 360°)</strong> nos dice hacia qué punto cardinal mirar
                  (0° Norte, 90° Este), y la <strong>Elevación (-90° a +90°)</strong> indica qué tan
                  alto está el astro sobre el horizonte. En los polos lunares el Sol nunca sube más
                  de ~7°, produciendo sombras kilométricas.
                </p>
              </div>
              <div className="edu-card">
                <span className="pill-badge">CONCEPTO 2 · LIBRACIÓN Y PUNTOS CIEGOS</span>
                <h3>¿Por qué un cráter puede dejarnos sin señal?</h3>
                <p>
                  Como la Luna muestra siempre la misma cara a la Tierra, desde un sitio polar la
                  Tierra sube y baja lentamente unos pocos grados (libración). Si aterrizas dentro
                  de un cráter cuyas paredes miden 10° de altura aparente, quedas en un{' '}
                  <strong>punto ciego permanente</strong> sin radio ni confirmación por satélite.
                </p>
              </div>
              <div className="edu-card">
                <span className="pill-badge">CONCEPTO 3 · REINER GAMMA Y POLVO LUNAR</span>
                <h3>Anomalías magnéticas y exosfera (~2 km)</h3>
                <p>
                  Aunque la Luna no tiene campo magnético global, regiones como{' '}
                  <strong>Reiner Gamma (~28 nT)</strong> forman mini-magnetosferas locales que
                  desvían el viento solar y reducen el levantamiento electrostático de polvo de
                  regolito.
                </p>
              </div>
            </section>
          )}

          {profile === 'professional' && (
            <section className="metrics" aria-label="Métricas orbitales y cinemáticas">
              <Metric
                value={`${report.metrics.sun_visible_pct}%`}
                label="Tiempo con iluminación solar directa"
              />
              <Metric
                value={`${report.metrics.earth_visible_pct}%`}
                label="Tiempo con enlace directo a Tierra (LoS)"
              />
              <Metric
                value={`${report.metrics.both_visible_pct}%`}
                label="Ventana simultánea: Potencia + Enlace"
              />
              <Metric
                value={`${viability.kinematics.orbitalVelocityKmS} km/s`}
                label="Velocidad circular de inserción orbital"
              />
              <Metric
                value={`${viability.kinematics.escapeVelocityKmS} km/s`}
                label="Velocidad de escape/salida en superficie"
              />
              <Metric
                value={`${viability.kinematics.optimalApproachAzimuthDeg}°`}
                label="Acimut óptimo de descenso (antena libre)"
              />
            </section>
          )}

          {/* GRÁFICA DE ELEVACIÓN Y EXPLORADOR TEMPORAL (PROFESIONAL Y EDUCATIVO) */}
          {profile !== 'kids' && (
            <section className="chart-section">
              <div className="chart-header-row">
                <div>
                  <h2>Elevación del Sol y de la Tierra sobre el Horizonte Local (`ElevationChart.tsx`)</h2>
                  <p className="muted">
                    {fmt(report.start)} a {fmt(report.end)} (resolución de 1 hora).{' '}
                    {report.horizon.type === 'smooth'
                      ? 'Horizonte esférico de referencia (1737.4 km).'
                      : 'Horizonte topográfico con máscara de obstrucción de cráter (LOLA).'}
                  </p>
                </div>
                <div className="sample-inspector mono">
                  <span>Instante activo: {fmt(activeSample.t)}</span>
                  <span>
                    Sol: Az {activeSample.sun_az.toFixed(1)}° / El {activeSample.sun_el.toFixed(2)}°
                  </span>
                  <span>
                    Tierra: Az {activeSample.earth_az.toFixed(1)}° / El{' '}
                    {activeSample.earth_el.toFixed(2)}°
                  </span>
                </div>
              </div>

              <ElevationChart
                report={report}
                selectedIndex={selectedSampleIdx}
                onSelectIndex={setSelectedSampleIdx}
              />

              <div className="time-scrubber">
                <label>
                  <span>
                    Sincronizador de Época UTC (haz clic en la gráfica o desliza para contrastar con
                    SpaceEngine):
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, report.series.length - 1)}
                    value={selectedSampleIdx}
                    onChange={(e) => setSelectedSampleIdx(Number(e.target.value))}
                  />
                </label>
              </div>
            </section>
          )}

          {/* DEFENSA DE ARQUITECTURA EN 3 CAPAS, SPACE ENGINE, AMBIENTE LUNAR Y MENTORES */}
          <ArchitectureDefensePanel site={site} viability={viability} activeSample={activeSample} />

          {/* TABLA DE EVENTOS DE SALIDA Y PUESTA (VISTA PROFESIONAL) */}
          {profile === 'professional' && report.events.length > 0 && (
            <section>
              <h2>Eventos de Salida y Ocultación en el Horizonte (`events.ts`)</h2>
              <table>
                <thead>
                  <tr>
                    <th>Fecha y Hora (UTC)</th>
                    <th>Evento Astronómico / Enlace</th>
                    <th>Acimut desde el Norte</th>
                  </tr>
                </thead>
                <tbody>
                  {report.events.map((e) => (
                    <tr key={e.t + e.body}>
                      <td className="mono">{fmt(e.t)}</td>
                      <td>
                        {LABEL[e.body]} {e.type === 'rise' ? 'sale sobre el horizonte' : 'se oculta'}
                      </td>
                      <td className="mono">{e.az.toFixed(1)}° Az</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <footer className="muted">
            Cálculo ejecutado por el Kernel ORYSEL ({report.engine}). Kernels oficiales de NASA
            NAIF. Comprobado contra NASA/JPL Horizons para el mismo sitio y mes con diferencia
            máxima de 0.00003°. Arquitectura en 3 capas lista para despliegue en AWS.
          </footer>
        </>
      )}
    </main>
  )
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}
