import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArchitectureDefensePanel } from './components/ArchitectureDefensePanel.tsx'
import { ElevationChart } from './components/ElevationChart.tsx'
import { OnboardingModal, type UserSession } from './components/OnboardingModal.tsx'
import { OryBotAssistant } from './components/OryBotAssistant.tsx'
import { RocketVectorPlayground } from './components/RocketVectorPlayground.tsx'
import { SITES } from './data/sites.ts'
import {
  AWS_BASE_URL,
  FALLBACK_AWS_SITE_METRICS,
  fetchAwsTelemetry,
  fetchSiteHorizons,
  useClientFps,
  type AwsHorizonRow,
  type AwsTelemetryState,
} from './ephemeris/awsApi.ts'
import { computeViabilityKPI } from './ephemeris/report.ts'
import type { SiteReport, UserProfileMode } from './ephemeris/types.ts'

const fmt = (iso: string) => iso.replace('T', ' ').replace(':00Z', ' UTC').replace('Z', ' UTC')
const LABEL = { sun: 'Sol', earth: 'Tierra' } as const

export default function App() {
  const [selectedSiteId, setSelectedSiteId] = useState<string>('im2')
  const [profile, setProfile] = useState<UserProfileMode>('executive')
  const [session, setSession] = useState<UserSession>({
    name: 'Cmdr. ORYSEL',
    organization: 'NASA Space Apps · UP Chiapas',
    profile: 'executive',
  })
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false)
  const [showArchModal, setShowArchModal] = useState<boolean>(false)
  const [showSpaceEngineBox, setShowSpaceEngineBox] = useState<boolean>(false)
  const [proTableTab, setProTableTab] = useState<'horizons' | 'events'>('horizons')

  const [rawReport, setRawReport] = useState<SiteReport | null>(null)
  const [selectedSampleIdx, setSelectedSampleIdx] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)

  const clientFps = useClientFps()

  const [awsTelemetry, setAwsTelemetry] = useState<AwsTelemetryState>({
    online: true,
    pingRttMs: 18.4,
    dbQueryMs: 16.79,
    horizonsRecords: 5768,
    awsRegion: 'us-east-1',
    engine: 'PostgreSQL 16 + FastAPI',
    sourceLabel: 'AWS PostgreSQL (NASA/JPL Horizons)',
    siteMetrics: FALLBACK_AWS_SITE_METRICS,
    lastCheckedUtc: '2026-11-14T00:00:00Z',
  })

  const [horizonsData, setHorizonsData] = useState<{
    source: 'aws-live' | 'local-fallback'
    rows: AwsHorizonRow[]
  }>({ source: 'local-fallback', rows: [] })

  const site = useMemo(
    () => SITES.find((s) => s.id === selectedSiteId) ?? SITES[0],
    [selectedSiteId],
  )

  const refreshAwsTelemetry = useCallback(() => {
    fetchAwsTelemetry(3000).then(setAwsTelemetry)
  }, [])

  useEffect(() => {
    refreshAwsTelemetry()
    const timer = setInterval(refreshAwsTelemetry, 15000)
    return () => clearInterval(timer)
  }, [refreshAwsTelemetry])

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/${site.id}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((loaded: SiteReport) => {
        setError(null)
        setRawReport(loaded)
        setSelectedSampleIdx(Math.min(180, Math.max(0, Math.floor(loaded.series.length / 4))))
        return fetchSiteHorizons(site.id, 40, loaded.series, 3000)
      })
      .then((hz) => setHorizonsData(hz))
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
    <div className="app-shell">
      {/* TOPBAR EJECUTIVA COMPACTA TIPO MISSION CONTROL */}
      <header className="topbar" aria-label="Barra de control de misión ORYSEL">
        <div className="topbar-brand">
          <span className="brand-dot" />
          <div>
            <strong>ORYSEL</strong>
            <span className="brand-sub">Lunar Mission Control · Space Apps 2026</span>
          </div>
        </div>

        {/* Selector rápido de Sitio Lunar */}
        <div className="topbar-group">
          <label className="topbar-label" htmlFor="site-select">
            Sitio Lunar:
          </label>
          <select
            id="site-select"
            className="topbar-select"
            value={site.id}
            onChange={(e) => setSelectedSiteId(e.target.value)}
          >
            {SITES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Selector estricto de Vista por Audiencia */}
        <nav className="view-switcher" role="tablist" aria-label="Vista por audiencia">
          <button
            type="button"
            role="tab"
            aria-selected={profile === 'executive'}
            className={`view-tab ${profile === 'executive' ? 'active' : ''}`}
            onClick={() => setProfile('executive')}
          >
            Ejecutiva KPI
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={profile === 'professional'}
            className={`view-tab ${profile === 'professional' ? 'active' : ''}`}
            onClick={() => setProfile('professional')}
          >
            Profesional NASA
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={profile === 'educational'}
            className={`view-tab ${profile === 'educational' ? 'active' : ''}`}
            onClick={() => setProfile('educational')}
          >
            Educativa
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={profile === 'kids'}
            className={`view-tab ${profile === 'kids' ? 'active' : ''}`}
            onClick={() => setProfile('kids')}
          >
            Infantil / Gamificada
          </button>
        </nav>

        {/* Indicadores en vivo en esquina derecha */}
        <div className="topbar-telemetry">
          <span className="telemetry-badge fps-badge mono" title="Rendimiento de renderizado en cliente">
            ⚡ {clientFps} FPS
          </span>
          <button
            type="button"
            className={`telemetry-badge aws-badge mono ${awsTelemetry.online ? 'online' : 'cached'}`}
            onClick={refreshAwsTelemetry}
            title={`Instancia AWS EC2: ${AWS_BASE_URL} (clic para actualizar ping)`}
          >
            <span className="status-led" />
            {awsTelemetry.online && awsTelemetry.pingRttMs !== null
              ? `AWS ${awsTelemetry.pingRttMs}ms`
              : 'AWS Sync'}{' '}
            | DB {awsTelemetry.dbQueryMs}ms | {awsTelemetry.horizonsRecords.toLocaleString('en-US')}{' '}
            rows
          </button>
          <button
            type="button"
            className="btn-secondary btn-compact"
            onClick={() => setShowArchModal(true)}
          >
            Arquitectura &amp; API AWS
          </button>
          <button
            type="button"
            className="btn-ghost btn-compact"
            onClick={() => setShowOnboarding(true)}
            title="Configurar cuenta y audiencia"
          >
            👤 {session.name}
          </button>
        </div>
      </header>

      <main className="mission-main">
        {/* Cabecera contextual compacta del sitio activo */}
        <section className="site-context-strip" aria-label="Contexto del sitio lunar seleccionado">
          <div className="site-context-left">
            <span className="eyebrow">
              {site.region ?? 'Exploración Lunar'} · Fuente: {site.source}
            </span>
            <h1>{site.name}</h1>
            <p className="muted">
              Coordenadas MOON_ME: {Math.abs(site.lat).toFixed(4)}° {site.lat < 0 ? 'S' : 'N'},{' '}
              {Math.abs(site.lon).toFixed(4)}° {site.lon < 0 ? 'W' : 'E'} ({site.heightKm} km) —{' '}
              {site.description}
            </p>
          </div>
          <div className="site-quick-pills">
            {SITES.map((item) => {
              const isBlind = item.id === 'shackleton-blindspot'
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`quick-site-pill ${item.id === site.id ? 'active' : ''} ${isBlind ? 'danger' : ''}`}
                  onClick={() => setSelectedSiteId(item.id)}
                >
                  <span>{item.name.split(' (')[0]}</span>
                  <small>{isBlind ? 'NO-GO' : 'GO'}</small>
                </button>
              )
            })}
          </div>
        </section>

        {error && <p className="error">No se pudieron cargar las efemérides del sitio: {error}</p>}
        {!report && !error && <p className="muted">Cargando efemérides SPICE DE440…</p>}

        {report && viability && activeSample && (
          <>
            {/* =====================================================================
                VISTA 1: EJECUTIVA / TOMA DE DECISIONES (VISTA POR DEFECTO)
               ===================================================================== */}
            {profile === 'executive' && (
              <div className="view-container">
                {/* Bloque de KPI de Viabilidad Consolidado */}
                <section
                  className={`kpi-executive-panel ${viability.blindSpotDetected ? 'vetoed' : 'viable'}`}
                  aria-label="Indicador de Viabilidad de la Misión (KPI)"
                >
                  <div className="kpi-score-box">
                    <span className="pill-badge">KPI DE VIABILIDAD CONSOLIDADO</span>
                    <div className="kpi-number-row">
                      <strong className="kpi-giant-number">{viability.scorePct}%</strong>
                      <span
                        className={`verdict-pill ${viability.blindSpotDetected ? 'nogo' : 'go'}`}
                      >
                        {viability.blindSpotDetected
                          ? 'NO-GO · SOMBRA DE COMUNICACIÓN'
                          : viability.verdict}
                      </span>
                    </div>
                    <span className="muted">
                      Decisión ejecutiva calculada con SPICE DE440 + AWS PostgreSQL
                    </span>
                  </div>

                  <div className="kpi-filters-box">
                    <div className={`filter-check ${viability.commLinkOk ? 'pass' : 'fail'}`}>
                      <span className="status-icon">{viability.commLinkOk ? '✓' : '✕'}</span>
                      <div>
                        <strong>Enlace Directo Tierra-Tripulación</strong>
                        <small>
                          {viability.commLinkOk
                            ? `${report.metrics.earth_visible_pct}% del mes con línea de vista directa`
                            : 'Fallo crítico: pérdida de enlace por ocultación topográfica'}
                        </small>
                      </div>
                    </div>

                    <div className={`filter-check ${viability.orbiterPhotoLoS ? 'pass' : 'fail'}`}>
                      <span className="status-icon">{viability.orbiterPhotoLoS ? '✓' : '✕'}</span>
                      <div>
                        <strong>Visibilidad Satélite Orbital (Confirmación Fotográfica)</strong>
                        <small>
                          {viability.orbiterPhotoLoS
                            ? `Pase orbital (${site.orbiterPassElDeg ?? 45}°) libre de puntos ciegos`
                            : 'Punto ciego detectado: muralla del cráter bloquea cámara orbital'}
                        </small>
                      </div>
                    </div>

                    {viability.vetoReason && (
                      <p className="veto-alert-box">
                        <strong>FILTRO DETERMINANTE:</strong> {viability.vetoReason}
                      </p>
                    )}
                  </div>

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
                </section>

                {/* Tarjetas Comparativas sincronizadas desde PostgreSQL en AWS */}
                <section
                  className="aws-comparison-section"
                  aria-label="Comparativa de sitios desde PostgreSQL en AWS"
                >
                  <div className="section-header-inline">
                    <div>
                      <span className="pill-badge">
                        DATOS EN TIEMPO REAL · {awsTelemetry.sourceLabel}
                      </span>
                      <h2>
                        Comparativa de Visibilidad Sol y Tierra en AWS (`prueba.horizons_im2`)
                      </h2>
                    </div>
                    <span className="mono muted">
                      Región: {awsTelemetry.awsRegion} · {awsTelemetry.horizonsRecords} registros
                    </span>
                  </div>

                  <div className="aws-sites-grid">
                    {SITES.map((s) => {
                      const solRow = awsTelemetry.siteMetrics.find(
                        (m) => m.sitio_id === s.id && m.cuerpo === 'sol',
                      )
                      const tierraRow = awsTelemetry.siteMetrics.find(
                        (m) => m.sitio_id === s.id && m.cuerpo === 'tierra',
                      )
                      const isCurrent = s.id === site.id
                      const isVetoed = s.id === 'shackleton-blindspot'

                      return (
                        <div
                          key={s.id}
                          className={`aws-site-card ${isCurrent ? 'active' : ''} ${isVetoed ? 'veto' : ''}`}
                          onClick={() => setSelectedSiteId(s.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') setSelectedSiteId(s.id)
                          }}
                        >
                          <div className="aws-site-card-head">
                            <strong>{s.name}</strong>
                            <span className={`tag-mini ${isVetoed ? 'danger' : 'ok'}`}>
                              {isVetoed ? 'NO-GO (Sombra Comm)' : 'GO'}
                            </span>
                          </div>
                          <div className="aws-bars">
                            <div className="aws-bar-row">
                              <span>☀ Sol visible (Horizons)</span>
                              <strong className="mono">{solRow?.pct_visible ?? 50}%</strong>
                            </div>
                            <div className="progress-track">
                              <div
                                className="progress-fill sun"
                                style={{ width: `${solRow?.pct_visible ?? 50}%` }}
                              />
                            </div>

                            <div className="aws-bar-row">
                              <span>🌍 Tierra visible (LoS)</span>
                              <strong className="mono">{tierraRow?.pct_visible ?? 75}%</strong>
                            </div>
                            <div className="progress-track">
                              <div
                                className="progress-fill earth"
                                style={{ width: `${tierraRow?.pct_visible ?? 75}%` }}
                              />
                            </div>
                          </div>
                          <div className="aws-card-foot mono">
                            <span>
                              El Sol: [{solRow?.el_min ?? 0}°, {solRow?.el_max ?? 0}°]
                            </span>
                            <span>
                              El Tierra: [{tierraRow?.el_min ?? 0}°, {tierraRow?.el_max ?? 0}°]
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>

                {/* Riesgos Ambientales Lunares (Exosfera, Regolito Gaussiano, Reiner Gamma) */}
                <section
                  className="env-risks-grid"
                  aria-label="Modelado de riesgos ambientales lunares"
                >
                  <div className="env-card">
                    <span className="pill-badge">AMBIENTE 1 · EXOSFERA LUNAR (~2 KM)</span>
                    <h3>Interacción de Capa Límite Superficial</h3>
                    <p className="muted">
                      Índice de exposición en {site.name}:{' '}
                      <strong className="mono">{site.exosphereInteractionIndex ?? 0.2}</strong>.
                      Modela la dispersión de gases neutros y el penacho de descenso en los primeros
                      ~2 km sobre el regolito.
                    </p>
                  </div>

                  <div className="env-card">
                    <span className="pill-badge">AMBIENTE 2 · DISPERSIÓN GAUSSIANA Y REGOLITO</span>
                    <h3>Nubes Electrostáticas y Elipse 3σ</h3>
                    <p className="muted">
                      Riesgo de levitación electrostática:{' '}
                      <strong className="mono">{site.electrostaticDustRisk ?? 'MODERATE'}</strong>.
                      Elipse de alunizaje con distribución gaussiana 3σ:{' '}
                      <strong className="mono">
                        ±{viability.kinematics.landingEllipse3SigmaKm} km
                      </strong>
                      .
                    </p>
                  </div>

                  <div className="env-card">
                    <span className="pill-badge">AMBIENTE 3 · ANOMALÍA MAGNÉTICA CORTICAL</span>
                    <h3>Protección ante Viento Solar ({site.magneticAnomalynT ?? 2} nT)</h3>
                    <p className="muted">
                      {site.id === 'reiner-gamma'
                        ? 'Reiner Gamma presenta una mini-magnetosfera cortical de ~28 nT que deflecta protones del viento solar y reduce la carga electrostática.'
                        : `Campo cortical local de ${site.magneticAnomalynT ?? 2} nT. Compare con Reiner Gamma (28 nT) para evaluar blindaje natural.`}
                    </p>
                  </div>
                </section>
              </div>
            )}

            {/* =====================================================================
                VISTA 2: PROFESIONAL (ESPECIALISTAS NASA / MECÁNICA ORBITAL)
               ===================================================================== */}
            {profile === 'professional' && (
              <div className="view-container">
                <section className="metrics" aria-label="Métricas orbitales y cinemáticas NASA">
                  <Metric
                    value={`${report.metrics.sun_visible_pct}%`}
                    label="Iluminación solar directa (SPICE)"
                  />
                  <Metric
                    value={`${report.metrics.earth_visible_pct}%`}
                    label="Enlace directo a Tierra (LoS)"
                  />
                  <Metric
                    value={`${report.metrics.both_visible_pct}%`}
                    label="Ventana simultánea Potencia + Enlace"
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
                    label="Acimut óptimo de aproximación"
                  />
                </section>

                <section className="chart-section">
                  <div className="chart-header-row">
                    <div>
                      <h2>
                        Curvas de Elevación Topocéntrica y Umbral de Enlace (`ElevationChart.tsx`)
                      </h2>
                      <p className="muted">
                        {fmt(report.start)} a {fmt(report.end)} · Marco MOON_ME (LT+S).{' '}
                        {report.horizon.type === 'smooth'
                          ? 'Esfera de referencia lunar (1737.4 km).'
                          : 'Horizonte con máscara de obstrucción topográfica de cráter.'}
                      </p>
                    </div>
                    <div className="pro-actions-bar">
                      <div className="sample-inspector mono">
                        <span>{fmt(activeSample.t)}</span>
                        <span>
                          Sol: Az {activeSample.sun_az.toFixed(1)}° / El{' '}
                          {activeSample.sun_el.toFixed(2)}°
                        </span>
                        <span>
                          Tierra: Az {activeSample.earth_az.toFixed(1)}° / El{' '}
                          {activeSample.earth_el.toFixed(2)}°
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary btn-compact"
                        onClick={() => setShowSpaceEngineBox((v) => !v)}
                      >
                        {showSpaceEngineBox
                          ? 'Ocultar Validación SpaceEngine'
                          : 'Datos de Validación para SpaceEngine 3D'}
                      </button>
                    </div>
                  </div>

                  {showSpaceEngineBox && (
                    <div className="spaceengine-callout mono">
                      <div>
                        <strong>CÁPSULA DE VALIDACIÓN 3D (SPACE ENGINE):</strong> Escena{' '}
                        <code>{site.spaceEnginePreset?.sceneName ?? '1-IM2-MonsMouton'}</code> |
                        Época UTC: <strong>{fmt(activeSample.t)}</strong> | Coordenadas:{' '}
                        <strong>
                          {site.lat.toFixed(4)}°, {site.lon.toFixed(4)}°
                        </strong>{' '}
                        | Sol Az {activeSample.sun_az.toFixed(2)}° El{' '}
                        {activeSample.sun_el.toFixed(2)}° | Tierra Az{' '}
                        {activeSample.earth_az.toFixed(2)}° El {activeSample.earth_el.toFixed(2)}°
                      </div>
                      {site.spaceEnginePreset?.cameraNote && (
                        <small>{site.spaceEnginePreset.cameraNote}</small>
                      )}
                    </div>
                  )}

                  <ElevationChart
                    report={report}
                    selectedIndex={selectedSampleIdx}
                    onSelectIndex={setSelectedSampleIdx}
                  />

                  <div className="time-scrubber">
                    <label>
                      <span>
                        Sincronizador de Época UTC (desliza o haz clic en la gráfica para
                        inspeccionar efemérides y contrastar con SpaceEngine):
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

                {/* Tablas técnicas conmutables (Serie AWS Horizons vs Eventos de Horizonte) */}
                <section className="pro-tables-section">
                  <div className="section-header-inline">
                    <div className="table-tabs">
                      <button
                        type="button"
                        className={`btn-chip ${proTableTab === 'horizons' ? 'active-chip' : ''}`}
                        onClick={() => setProTableTab('horizons')}
                      >
                        Serie NASA JPL Horizons desde AWS (`/api/horizons/{site.id}`)
                      </button>
                      <button
                        type="button"
                        className={`btn-chip ${proTableTab === 'events' ? 'active-chip' : ''}`}
                        onClick={() => setProTableTab('events')}
                      >
                        Eventos de Salida y Ocultación ({report.events.length})
                      </button>
                    </div>
                    <span className="mono muted">
                      Origen:{' '}
                      {horizonsData.source === 'aws-live'
                        ? `AWS EC2 PostgreSQL (${AWS_BASE_URL})`
                        : 'Cache Local Verificado con JPL Horizons (< 0.00003°)'}
                    </span>
                  </div>

                  {proTableTab === 'horizons' ? (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Sitio</th>
                            <th>Época UTC (`t`)</th>
                            <th>Cuerpo</th>
                            <th>Acimut (`az_deg`)</th>
                            <th>Elevación (`el_deg`)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {horizonsData.rows.slice(0, 24).map((r, idx) => (
                            <tr key={`${r.t}-${r.cuerpo}-${idx}`}>
                              <td className="mono">{r.sitio_id || site.id}</td>
                              <td className="mono">{fmt(r.t)}</td>
                              <td>{r.cuerpo === 'sol' ? '☀ Sol' : '🌍 Tierra'}</td>
                              <td className="mono">{Number(r.az_deg).toFixed(4)}°</td>
                              <td className="mono">{Number(r.el_deg).toFixed(4)}°</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Fecha y Hora (UTC)</th>
                            <th>Evento Astronómico / Enlace</th>
                            <th>Acimut desde el Norte</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.events.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="muted">
                                Sin cruces de horizonte en el periodo (visibilidad constante o
                                bloqueada por relieve).
                              </td>
                            </tr>
                          ) : (
                            report.events.map((e) => (
                              <tr key={e.t + e.body}>
                                <td className="mono">{fmt(e.t)}</td>
                                <td>
                                  {LABEL[e.body]}{' '}
                                  {e.type === 'rise' ? 'sale sobre el horizonte' : 'se oculta'}
                                </td>
                                <td className="mono">{e.az.toFixed(2)}° Az</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* =====================================================================
                VISTA 3: EDUCATIVA (ESTUDIANTES / DIVULGACIÓN)
               ===================================================================== */}
            {profile === 'educational' && (
              <div className="view-container">
                <section className="edu-cards-grid" aria-label="Guía interactiva de mecánica orbital">
                  <div className="edu-card">
                    <span className="pill-badge">1 · PARÁMETROS ORBITALES</span>
                    <h3>¿Qué son el Acimut y la Elevación?</h3>
                    <p>
                      El <strong>Acimut (0° a 360°)</strong> indica la dirección en la brújula lunar
                      (0° Norte, 90° Este), mientras que la <strong>Elevación (-90° a +90°)</strong>{' '}
                      mide qué tan alto está el Sol o la Tierra sobre el suelo. En el polo sur lunar
                      el Sol nunca sube más de ~7°, creando sombras larguísimas.
                    </p>
                  </div>

                  <div className="edu-card">
                    <span className="pill-badge">2 · LÍNEA DE VISIÓN TIERRA-LUNA</span>
                    <h3>Libración Lunar y Sombra de Comunicación</h3>
                    <p>
                      Como la Luna gira sincronizada con la Tierra, nuestro planeta parece quedarse
                      casi fijo en el cielo lunar, balanceándose apenas unos grados (libración). Si
                      alunizas detrás de la pared de un cráter de 10°, pierdes la{' '}
                      <strong>Línea de Visión (LoS)</strong> y quedas incomunicado.
                    </p>
                  </div>

                  <div className="edu-card">
                    <span className="pill-badge">3 · CLIMA ESPACIAL Y REINER GAMMA</span>
                    <h3>Exosfera (~2 km), Polvo y Remolinos Magnéticos</h3>
                    <p>
                      La radiación solar carga electrostáticamente el polvo fino lunar (regolito),
                      haciéndolo levitar en el terminador. Sitios como{' '}
                      <strong>Reiner Gamma (~28 nT)</strong> actúan como pequeños escudos magnéticos
                      naturales que desvían parte del viento solar.
                    </p>
                  </div>
                </section>

                <section className="chart-section">
                  <div className="chart-header-row">
                    <div>
                      <h2>Explorador Visual del Cielo Lunar en {site.name}</h2>
                      <p className="muted">
                        Haz clic o mueve el control inferior para ver cómo cambian la altura del Sol
                        (energía) y de la Tierra (radio) día tras día.
                      </p>
                    </div>
                    <div className="sample-inspector mono">
                      <span>Fecha: {fmt(activeSample.t)}</span>
                      <span>Altura Sol: {activeSample.sun_el.toFixed(1)}°</span>
                      <span>Altura Tierra: {activeSample.earth_el.toFixed(1)}°</span>
                    </div>
                  </div>

                  <ElevationChart
                    report={report}
                    selectedIndex={selectedSampleIdx}
                    onSelectIndex={setSelectedSampleIdx}
                  />

                  <div className="time-scrubber">
                    <label>
                      <span>Mueve la línea del tiempo a lo largo del mes lunar:</span>
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
              </div>
            )}

            {/* =====================================================================
                VISTA 4: INFANTIL / GAMIFICADA (SOLO VEREDICTO BINARIO + VECTORES)
               ===================================================================== */}
            {profile === 'kids' && (
              <div className="view-container">
                <RocketVectorPlayground site={site} viability={viability} />
              </div>
            )}

            {/* WIDGET FLOTANTE COLAPSABLE ORY-BOT (ESQUINA INFERIOR DERECHA) */}
            <OryBotAssistant
              site={site}
              viability={viability}
              profile={profile}
              activeSample={activeSample}
              userName={session.name}
              onSelectSiteId={setSelectedSiteId}
            />

            {/* MODAL / DRAWER DE ARQUITECTURA EN 3 CAPAS Y API ABIERTA AWS */}
            {showArchModal && (
              <ArchitectureDefensePanel
                site={site}
                viability={viability}
                activeSample={activeSample}
                awsTelemetry={awsTelemetry}
                clientFps={clientFps}
                onClose={() => setShowArchModal(false)}
              />
            )}
          </>
        )}

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
      </main>
    </div>
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
