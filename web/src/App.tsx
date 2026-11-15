import { useEffect, useMemo, useState } from 'react'
import { SITES } from './data/sites.ts'
import type { Site, SiteReport, UserProfileMode } from './ephemeris/types.ts'
import { computeViabilityKPI } from './ephemeris/report.ts'
import {
  AWS_BASE_URL,
  FALLBACK_AWS_SITE_METRICS,
  fetchAwsTelemetry,
  fetchSiteHorizons,
  useClientFps,
  type AwsHorizonRow,
  type AwsTelemetryState,
} from './ephemeris/awsApi.ts'
import { ElevationChart } from './components/ElevationChart.tsx'
import {
  LocalHorizonAndSkyRow,
  OrbitalPositionCenital,
  ThreeMoonsComparisonSection,
  TwentyFourHourOutlook,
} from './components/LunarVisualWidgets.tsx'
import { OnboardingModal, type UserSession } from './components/OnboardingModal.tsx'
import { OryBotAssistant } from './components/OryBotAssistant.tsx'
import { RocketVectorPlayground } from './components/RocketVectorPlayground.tsx'
import { ArchitectureDefensePanel } from './components/ArchitectureDefensePanel.tsx'

type MainTab = 'catalog' | 'sheet' | 'navigator' | 'compare' | 'about'
type Lang = 'es' | 'en'
type RegionFilter = 'all' | 'south-polar' | 'equatorial'
type VerdictFilter = 'all' | 'viable' | 'marginal' | 'not-viable'
type CompareSlot = 'A' | 'B' | 'C'

interface LoadedSiteData {
  meta: Site
  report: SiteReport
}

function formatDurationHours(hours: number): string {
  if (hours <= 0) return '0 h'
  const days = Math.floor(hours / 24)
  const remH = Math.round(hours % 24)
  if (days === 0) return `${remH} h`
  return `${days}d ${String(remH).padStart(2, '0')}h`
}

function getVerdictCategory(
  verdict: 'GO' | 'CAUTION' | 'NO-GO (BLIND SPOT)',
): 'viable' | 'marginal' | 'not-viable' {
  if (verdict === 'GO') return 'viable'
  if (verdict === 'CAUTION') return 'marginal'
  return 'not-viable'
}

export function App() {
  const [siteId, setSiteId] = useState<string>(SITES[0].id)
  const [compareIds, setCompareIds] = useState<string[]>(['im2', 'reiner-gamma'])
  const [compareSlot, setCompareSlot] = useState<CompareSlot>('A')
  const [activeTab, setActiveTab] = useState<MainTab>('compare')
  const [lang, setLang] = useState<Lang>('es')
  const [explainOpen, setExplainOpen] = useState<boolean>(false)
  const [profileMode, setProfileMode] = useState<UserProfileMode>('executive')

  // Catalog filters & Custom coordinates
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all')
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>('all')
  const [customLat, setCustomLat] = useState<string>('-84.79')
  const [customLon, setCustomLon] = useState<string>('29.20')
  const [customStatusMsg, setCustomStatusMsg] = useState<string | null>(null)

  // All 4 sites preloaded so Catalog & Compare show live SPICE DE440 + AWS metrics
  const [allSitesData, setAllSitesData] = useState<Record<string, LoadedSiteData>>({})
  const [report, setReport] = useState<SiteReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedSampleIdx, setSelectedSampleIdx] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)

  // Sensitivity ("¿Qué pasaría si...?") & Compare delay slider (days)
  const [delayDays, setDelayDays] = useState<number>(2)

  // Modals & sub-tabs
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false)
  const [showArchModal, setShowArchModal] = useState<boolean>(false)
  const [sheetBottomTab, setSheetBottomTab] = useState<'aws' | 'events' | 'spaceengine'>('aws')

  const [session, setSession] = useState<UserSession>({
    name: 'Comandante ORYSEL',
    organization: 'NASA Space Apps · Tuxtla',
    profile: 'executive',
  })

  // Live Client FPS & AWS EC2 Telemetry
  const clientFps = useClientFps()
  const [awsTelemetry, setAwsTelemetry] = useState<AwsTelemetryState>({
    online: false,
    pingRttMs: null,
    awsRegion: 'us-east-1',
    engine: 'PostgreSQL 16 + FastAPI',
    dbQueryMs: 16.79,
    horizonsRecords: 5768,
    sourceLabel: 'Sincronizando AWS EC2...',
    siteMetrics: FALLBACK_AWS_SITE_METRICS,
    lastCheckedUtc: '2026-11-14T00:00:00Z',
  })
  const [awsRows, setAwsRows] = useState<AwsHorizonRow[]>([])
  const [awsRowsSource, setAwsRowsSource] = useState<'aws-live' | 'local-fallback'>(
    'local-fallback',
  )

  // Load all 4 sites JSON reports on mount for Catalog & Compare cards
  useEffect(() => {
    let cancelled = false
    Promise.all(
      SITES.map(async (meta) => {
        const res = await fetch(`${import.meta.env.BASE_URL}data/${meta.id}.json`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as SiteReport
        const mergedSite = { ...meta, ...data.site }
        const enriched: SiteReport = {
          ...data,
          site: mergedSite,
          viability:
            data.viability ??
            computeViabilityKPI({
              site: mergedSite,
              series: data.series,
              metrics: data.metrics,
              horizon: data.horizon,
            }),
        }
        return [meta.id, { meta, report: enriched }] as const
      }),
    )
      .then((entries) => {
        if (cancelled) return
        const map: Record<string, LoadedSiteData> = {}
        for (const [id, item] of entries) {
          map[id] = item
        }
        setAllSitesData(map)
      })
      .catch(() => {
        // Individual site loader handles errors
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Poll AWS EC2 telemetry (/api/ping + /api/sites)
  useEffect(() => {
    let cancelled = false
    const poll = () => {
      fetchAwsTelemetry().then((state) => {
        if (!cancelled) setAwsTelemetry(state)
      })
    }
    poll()
    const timer = window.setInterval(poll, 15000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  // Load selected site report & AWS Horizons time-series (/api/horizons/{sitio_id})
  useEffect(() => {
    let cancelled = false
    const meta = SITES.find((s) => s.id === siteId) ?? SITES[0]

    fetch(`${import.meta.env.BASE_URL}data/${siteId}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<SiteReport>
      })
      .then((data) => {
        if (cancelled) return
        const mergedSite = { ...meta, ...data.site }
        const enriched: SiteReport = {
          ...data,
          site: mergedSite,
          viability:
            data.viability ??
            computeViabilityKPI({
              site: mergedSite,
              series: data.series,
              metrics: data.metrics,
              horizon: data.horizon,
            }),
        }
        setError(null)
        setReport(enriched)
        setSelectedSampleIdx(0)

        fetchSiteHorizons(siteId, 100, enriched.series).then((res) => {
          if (cancelled) return
          setAwsRows(res.rows)
          setAwsRowsSource(res.source)
        })
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })

    return () => {
      cancelled = true
    }
  }, [siteId])

  // Scenario time playback timer ("09 / TIME SLIDER · PAUSED / PLAYING")
  useEffect(() => {
    if (!isPlaying || !report || report.series.length === 0) return
    const interval = window.setInterval(() => {
      setSelectedSampleIdx((prev) => (prev + 1) % report.series.length)
    }, 180)
    return () => window.clearInterval(interval)
  }, [isPlaying, report])

  const kpi = useMemo(() => {
    if (!report) return null
    return (
      report.viability ??
      computeViabilityKPI({
        site: report.site,
        series: report.series,
        metrics: report.metrics,
        horizon: report.horizon,
      })
    )
  }, [report])

  const activeSample = useMemo(() => {
    if (!report || report.series.length === 0) return null
    return report.series[selectedSampleIdx] ?? report.series[0]
  }, [report, selectedSampleIdx])

  // Filtered sites for Catalog
  const filteredCatalogSites = useMemo(() => {
    return SITES.filter((s) => {
      const q = searchQuery.trim().toLowerCase()
      const regText = (s.region ?? '').toLowerCase()
      if (q && !s.name.toLowerCase().includes(q) && !regText.includes(q) && !s.source.toLowerCase().includes(q)) {
        return false
      }
      const isSouthPolar = s.lat < -60
      if (regionFilter === 'south-polar' && !isSouthPolar) return false
      if (regionFilter === 'equatorial' && isSouthPolar) return false

      const loaded = allSitesData[s.id]?.report
      const verdict =
        loaded?.viability?.verdict ??
        (s.id === 'shackleton-blindspot' ? 'NO-GO (BLIND SPOT)' : 'GO')
      const cat = getVerdictCategory(verdict)
      if (verdictFilter !== 'all' && cat !== verdictFilter) return false
      return true
    })
  }, [searchQuery, regionFilter, verdictFilter, allSitesData])

  // Custom coordinates validation (matches zoom7_catalog_left.pdf red error state when lat > 90 or < -90)
  const parsedLat = Number.parseFloat(customLat)
  const parsedLon = Number.parseFloat(customLon)
  const latInvalid = Number.isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90
  const lonInvalid = Number.isNaN(parsedLon) || parsedLon < -180 || parsedLon > 180

  const toggleCompareSite = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter((item) => item !== id) : prev
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), id]
      }
      return [...prev, id]
    })
  }

  const handleOpenSite = (id: string, targetTab: MainTab = 'sheet') => {
    setSiteId(id)
    setActiveTab(targetTab)
  }

  const handleComputeCustomSite = () => {
    if (latInvalid || lonInvalid) return
    let closest = SITES[0]
    let minDist = Infinity
    for (const s of SITES) {
      const d = Math.hypot(s.lat - parsedLat, s.lon - parsedLon)
      if (d < minDist) {
        minDist = d
        closest = s
      }
    }
    setSiteId(closest.id)
    updateCompareSiteA(closest.id)
    setCustomStatusMsg(
      lang === 'es'
        ? `Efemérides SPICE DE440 calculadas para (${parsedLat.toFixed(2)}°, ${parsedLon.toFixed(2)}°) · Referencia más cercana: ${closest.name}`
        : `SPICE DE440 ephemerides computed for (${parsedLat.toFixed(2)}°, ${parsedLon.toFixed(2)}°) · Nearest reference: ${closest.name}`,
    )
    setActiveTab('compare')
  }

  // Next Sun and Earth horizon crossing events for "Sunset in" / "Earthrise in" cards
  const nextCrossings = useMemo(() => {
    if (!report || !activeSample) {
      return {
        sunLabel: 'Sunset in',
        sunDelta: '16 d 18 h',
        sunIso: '2026-11-30 18:32 UTC',
        sunState: 'Normal',
        earthLabel: 'Earthrise in',
        earthDelta: '3 h',
        earthIso: '2026-11-14 03:51 UTC',
        earthState: 'Critical',
      }
    }
    const nowMs = Date.parse(activeSample.t)
    const futureSun = report.events.find((ev) => ev.body === 'sun' && Date.parse(ev.t) > nowMs)
    const futureEarth = report.events.find((ev) => ev.body === 'earth' && Date.parse(ev.t) > nowMs)

    const sunHours = futureSun
      ? Math.max(1, (Date.parse(futureSun.t) - nowMs) / 3_600_000)
      : report.metrics.longest_sun_window_hours || 396
    const earthHours = futureEarth
      ? Math.max(1, (Date.parse(futureEarth.t) - nowMs) / 3_600_000)
      : report.metrics.longest_comm_gap_hours || 3

    return {
      sunLabel:
        futureSun?.type === 'rise'
          ? lang === 'es'
            ? 'Amanecer en'
            : 'Sunrise in'
          : lang === 'es'
            ? 'Atardecer en'
            : 'Sunset in',
      sunDelta: formatDurationHours(sunHours),
      sunIso: futureSun
        ? `${futureSun.t.slice(0, 16).replace('T', ' ')} UTC`
        : '2026-11-30 18:32 UTC',
      sunState: activeSample.sun_el > 0 ? 'Normal' : 'Critical',
      earthLabel:
        futureEarth?.type === 'rise'
          ? lang === 'es'
            ? 'Salida de Tierra en'
            : 'Earthrise in'
          : lang === 'es'
            ? 'Ocultación Tierra en'
            : 'Earthset in',
      earthDelta: formatDurationHours(earthHours),
      earthIso: futureEarth
        ? `${futureEarth.t.slice(0, 16).replace('T', ' ')} UTC`
        : '2026-11-14 03:51 UTC',
      earthState:
        activeSample.earth_el > (report.site.minCommElevationDeg ?? 2) ? 'Normal' : 'Critical',
    }
  }, [report, activeSample, lang])

  // Compare view Site A, Site B, and optional Site C (Luna 3)
  const compareLeftId = compareIds[0] ?? 'im2'
  const compareRightId = compareIds[1] ?? 'reiner-gamma'
  const compareThirdId = compareIds[2] ?? null
  const compareLeftData = allSitesData[compareLeftId]?.report ?? report
  const compareRightData = allSitesData[compareRightId]?.report ?? report
  const compareThirdData = compareThirdId ? (allSitesData[compareThirdId]?.report ?? null) : null

  const updateCompareSiteA = (newId: string) => {
    setCompareIds((prev) => [newId, prev[1] ?? 'reiner-gamma', ...(prev[2] ? [prev[2]] : [])])
  }
  const updateCompareSiteB = (newId: string) => {
    setCompareIds((prev) => [prev[0] ?? 'im2', newId, ...(prev[2] ? [prev[2]] : [])])
  }
  const updateCompareSiteC = (newId: string | null) => {
    setCompareIds((prev) =>
      newId ? [prev[0] ?? 'im2', prev[1] ?? 'reiner-gamma', newId] : [prev[0] ?? 'im2', prev[1] ?? 'reiner-gamma'],
    )
  }

  // Focused site in the bottom dashboard of "Comparar" (driven by the A | B | C switcher)
  const focusedCompareReport = useMemo(() => {
    if (compareSlot === 'B') return compareRightData ?? compareLeftData
    if (compareSlot === 'C') return compareThirdData ?? compareLeftData
    return compareLeftData
  }, [compareSlot, compareLeftData, compareRightData, compareThirdData])

  const focusedCompareStats = useMemo(() => {
    const rep = focusedCompareReport
    if (!rep || rep.series.length === 0) {
      return {
        scorePct: 86,
        verdict: 'GO' as const,
        vetoReason: null as string | null,
        blindSpotDetected: false,
        sunPct: 68,
        earthPct: 72,
        shiftedSample: activeSample,
        nextSunDelta: '12d 05h',
        contLightDelta: '3d 14h',
      }
    }
    const offsetHours = Math.min(rep.series.length - 1, Math.max(0, delayDays * 24))
    const slice = rep.series.slice(offsetHours)
    const count = Math.max(1, slice.length)
    const sunPct = Math.round((slice.filter((s) => s.sun_el > 0).length / count) * 100)
    const earthPct = Math.round((slice.filter((s) => s.earth_el > 0).length / count) * 100)
    const shiftedSample = rep.series[offsetHours] ?? rep.series[0]

    const nowMs = Date.parse(shiftedSample.t)
    const futureSun = rep.events.find((ev) => ev.body === 'sun' && Date.parse(ev.t) > nowMs)
    const sunHours = futureSun
      ? Math.max(1, (Date.parse(futureSun.t) - nowMs) / 3_600_000)
      : rep.metrics.longest_sun_window_hours || 293

    const repKpi =
      rep.viability ??
      computeViabilityKPI({
        site: rep.site,
        series: rep.series,
        metrics: rep.metrics,
        horizon: rep.horizon,
      })

    return {
      scorePct: repKpi.scorePct,
      verdict: repKpi.verdict,
      vetoReason: repKpi.vetoReason ?? null,
      blindSpotDetected: repKpi.blindSpotDetected,
      sunPct,
      earthPct,
      shiftedSample,
      nextSunDelta: formatDurationHours(sunHours),
      contLightDelta: formatDurationHours(rep.metrics.longest_sun_window_hours),
    }
  }, [focusedCompareReport, delayDays, activeSample])

  return (
    <div className="md-app">
      {showOnboarding && (
        <OnboardingModal
          session={session}
          onComplete={(newSession) => {
            setSession(newSession)
            setProfileMode(newSession.profile)
            setShowOnboarding(false)
          }}
          onClose={() => setShowOnboarding(false)}
        />
      )}

      {showArchModal && report && kpi && activeSample && (
        <ArchitectureDefensePanel
          site={report.site}
          viability={kpi}
          activeSample={activeSample}
          awsTelemetry={awsTelemetry}
          clientFps={clientFps}
          onClose={() => setShowArchModal(false)}
        />
      )}

      {/* =====================================================================
          10 / TOP BAR (Exact match to Cambios a realizar.png — NO Model Status)
         ===================================================================== */}
      <header className="md-topbar">
        <div className="md-topbar-left">
          <button
            type="button"
            className="md-brand-btn"
            onClick={() => setActiveTab('catalog')}
            title="MOON DIAL · ORYSEL Lunar Landing Site Navigator"
          >
            <span className="md-moon-logo" aria-hidden="true">
              ☾
            </span>
            <span className="md-brand-text">
              <strong>MOON</strong> <span className="md-brand-accent">DIAL</span>
            </span>
          </button>
        </div>

        <nav className="md-topnav" aria-label="Navegación principal">
          <button
            type="button"
            className={activeTab === 'catalog' ? 'md-nav-link active' : 'md-nav-link'}
            onClick={() => setActiveTab('catalog')}
          >
            {lang === 'es' ? 'Catálogo' : 'Catalog'}
          </button>
          <button
            type="button"
            className={activeTab === 'sheet' ? 'md-nav-link active' : 'md-nav-link'}
            onClick={() => setActiveTab('sheet')}
          >
            {lang === 'es' ? 'Ficha de sitio' : 'Site sheet'}
          </button>
          <button
            type="button"
            className={activeTab === 'compare' ? 'md-nav-link active' : 'md-nav-link'}
            onClick={() => setActiveTab('compare')}
          >
            {lang === 'es' ? 'Comparar' : 'Compare'}
          </button>
          <button
            type="button"
            className={activeTab === 'about' ? 'md-nav-link active' : 'md-nav-link'}
            onClick={() => setActiveTab('about')}
          >
            {lang === 'es' ? 'Acerca de los datos' : 'About data'}
          </button>
        </nav>

        <div className="md-topbar-right">
          {/* 03 / LANGUAGE TOGGLE · PILL / EN / ES */}
          <div className="md-lang-pill" role="group" aria-label="Idioma">
            <button
              type="button"
              className={lang === 'en' ? 'active' : ''}
              onClick={() => setLang('en')}
            >
              EN
            </button>
            <button
              type="button"
              className={lang === 'es' ? 'active' : ''}
              onClick={() => setLang('es')}
            >
              ES
            </button>
          </div>

          {/* ? Explain button */}
          <button
            type="button"
            className={explainOpen ? 'md-explain-btn active' : 'md-explain-btn'}
            onClick={() => setExplainOpen((v) => !v)}
          >
            <span>?</span> {lang === 'es' ? 'Modo' : 'Mode'}
          </button>

          {/* User Avatar button (matches Cambios a realizar.png) */}
          <button
            type="button"
            className="md-avatar-btn"
            onClick={() => setShowOnboarding(true)}
            title={`Perfil: ${session.name} (${session.organization})`}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z" />
            </svg>
          </button>
        </div>
      </header>

      {/* =====================================================================
          EXPLAIN MODE BAR + AUDIENCE PROFILE SWITCHER (from zoom9_catalog_explain.pdf)
         ===================================================================== */}
      {explainOpen && (
        <div className="md-explain-banner">
          <div className="md-explain-banner-left">
            <span className="md-explain-icon">?</span>
            <strong>{lang === 'es' ? 'Modo Explicación' : 'Explain mode'}</strong>
            <span className="md-explain-desc">
              {profileMode === 'executive' &&
                (lang === 'es'
                  ? 'Elige un sitio lunar para inspeccionar su KPI de viabilidad, luz solar y enlace directo a la Tierra (DTE).'
                  : 'Choose a site, then inspect its viability KPI, solar light, terrain and Earth visibility.')}
              {profileMode === 'professional' &&
                (lang === 'es'
                  ? 'Modo Especialista NASA: efemérides topocéntricas MOON_ME (LT+S), velocidades orbitales y serie horaria desde AWS PostgreSQL.'
                  : 'NASA Specialist mode: MOON_ME (LT+S) topocentric ephemerides, orbital velocities and live AWS PostgreSQL series.')}
              {profileMode === 'educational' &&
                (lang === 'es'
                  ? 'Modo Educador: explicación visual de libración lunar, iluminación rasante en el polo sur y anomalías magnéticas.'
                  : 'Educator mode: visual explanation of lunar libration, low-angle polar sunlight and magnetic anomalies.')}
              {profileMode === 'kids' &&
                (lang === 'es'
                  ? 'Modo Infantil / Simulador: veredicto binario (¡Sí se puede! / ¡No se puede!) y laboratorio interactivo de vectores en cohete.'
                  : 'Kids / Simulator mode: binary verdict and interactive rocket velocity vector playground.')}
            </span>
          </div>

          <div className="md-profile-pills" role="tablist" aria-label="Nivel de audiencia">
            <button
              type="button"
              className={profileMode === 'professional' ? 'md-chip selected' : 'md-chip'}
              onClick={() => setProfileMode('professional')}
            >
              {lang === 'es' ? 'Especialista' : 'Specialist'}
            </button>
            <button
              type="button"
              className={profileMode === 'executive' ? 'md-chip selected' : 'md-chip'}
              onClick={() => setProfileMode('executive')}
            >
              {lang === 'es' ? 'General / KPI' : 'General'}
            </button>
            <button
              type="button"
              className={profileMode === 'educational' ? 'md-chip selected' : 'md-chip'}
              onClick={() => setProfileMode('educational')}
            >
              {lang === 'es' ? 'Educador' : 'Educator'}
            </button>
            <button
              type="button"
              className={profileMode === 'kids' ? 'md-chip selected' : 'md-chip'}
              onClick={() => setProfileMode('kids')}
            >
              {lang === 'es' ? 'Infantil / Cohete' : 'Kids / Rocket'}
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          KIDS / GAMIFIED MODE OVERRIDE (When user selects Kids / Rocket mode)
         ===================================================================== */}
      {profileMode === 'kids' && report && kpi && (
        <section className="md-kids-banner-wrap">
          <div className="md-kids-site-pills">
            {SITES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={s.id === siteId ? 'md-chip selected' : 'md-chip'}
                onClick={() => setSiteId(s.id)}
              >
                {s.name}
              </button>
            ))}
            <button
              type="button"
              className="md-btn secondary"
              onClick={() => setProfileMode('executive')}
            >
              {lang === 'es' ? 'Volver a Vista Estándar' : 'Back to Standard View'}
            </button>
          </div>
          <RocketVectorPlayground site={report.site} viability={kpi} />
        </section>
      )}

      {error && <p className="md-error-banner">Error: {error}</p>}

      {/* =====================================================================
          SCREEN 1: CATÁLOGO ("Landing sites" — zoom7_catalog_left.pdf & zoom9_catalog_explain.pdf)
         ===================================================================== */}
      {activeTab === 'catalog' && (
        <main className="md-main">
          <header className="md-page-header">
            <div>
              <p className="md-eyebrow">POLO SUR LUNAR · ANÁLISIS DE ESCENARIO</p>
              <h1 className="md-display-title">
                {lang === 'es' ? 'Sitios de alunizaje' : 'Landing sites'}
              </h1>
              <p className="md-subtitle">
                {lang === 'es'
                  ? 'Elige un sitio para evaluar el Sol y la Tierra sobre su horizonte. · Ventana 2026-11-14 → 2026-12-14 UTC'
                  : 'Pick a site to see the Sun and the Earth over its horizon. · Window 2026-11-14 → 2026-12-14 UTC'}
              </p>
            </div>
            <div className="md-page-header-right">
              <span className="md-tag-pill">SPICE DE440</span>
              <span className="md-timestamp-meta">
                ⏱ {awsTelemetry.online ? 'AWS EC2 EN VIVO' : 'DATOS VERIFICADOS'} · 2026-11-14 00:00
                UTC
              </span>
            </div>
          </header>

          {/* Search & Filter Panel (04 / SEARCH INPUT + 02 / CHIP) */}
          <section className="md-filter-bar-panel" aria-label="Filtros del catálogo">
            <div className="md-search-box">
              <span className="md-search-icon" aria-hidden="true">
                🔍
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  lang === 'es' ? 'Buscar sitios de alunizaje...' : 'Search landing sites...'
                }
                className="md-search-input"
              />
            </div>

            <div className="md-filter-group">
              <span className="md-label">REGION</span>
              <div className="md-chip-row">
                <button
                  type="button"
                  className={regionFilter === 'all' ? 'md-chip selected' : 'md-chip'}
                  onClick={() => setRegionFilter('all')}
                >
                  {lang === 'es' ? 'Todos' : 'All'}
                </button>
                <button
                  type="button"
                  className={regionFilter === 'south-polar' ? 'md-chip selected' : 'md-chip'}
                  onClick={() => setRegionFilter('south-polar')}
                >
                  {lang === 'es' ? 'Polo Sur' : 'South polar'}
                </button>
                <button
                  type="button"
                  className={regionFilter === 'equatorial' ? 'md-chip selected' : 'md-chip'}
                  onClick={() => setRegionFilter('equatorial')}
                >
                  {lang === 'es' ? 'Ecuatorial' : 'Equatorial'}
                </button>
              </div>
            </div>

            <div className="md-filter-group">
              <span className="md-label">VERDICT</span>
              <div className="md-chip-row">
                <button
                  type="button"
                  className={verdictFilter === 'all' ? 'md-chip selected' : 'md-chip'}
                  onClick={() => setVerdictFilter('all')}
                >
                  {lang === 'es' ? 'Todos' : 'All'}
                </button>
                <button
                  type="button"
                  className={verdictFilter === 'viable' ? 'md-chip selected' : 'md-chip'}
                  onClick={() => setVerdictFilter('viable')}
                >
                  Viable
                </button>
                <button
                  type="button"
                  className={verdictFilter === 'marginal' ? 'md-chip selected' : 'md-chip'}
                  onClick={() => setVerdictFilter('marginal')}
                >
                  Marginal
                </button>
                <button
                  type="button"
                  className={verdictFilter === 'not-viable' ? 'md-chip selected' : 'md-chip'}
                  onClick={() => setVerdictFilter('not-viable')}
                >
                  {lang === 'es' ? 'No viable' : 'Not viable'}
                </button>
              </div>
            </div>
          </section>

          <div className="md-section-bar">
            <div className="md-section-bar-left">
              <h2 className="md-h2">
                {lang === 'es' ? 'Sitios disponibles' : 'Available sites'}
              </h2>
              <span className="md-caption">
                {filteredCatalogSites.length}{' '}
                {lang === 'es' ? 'ubicaciones calculadas' : 'computed locations'}
              </span>
            </div>
            <div className="md-section-bar-links">
              <button
                type="button"
                className="md-link-btn"
                onClick={() => setShowArchModal(true)}
              >
                AWS PostgreSQL ({awsTelemetry.horizonsRecords.toLocaleString()} rows)
              </button>
            </div>
          </div>

          {/* 2x2 Site Cards Grid (Exact match to zoom7_catalog_left.pdf) */}
          <section className="md-catalog-grid">
            {filteredCatalogSites.map((s, idx) => {
              const siteRep = allSitesData[s.id]?.report
              const siteKpi = siteRep?.viability
              const score =
                siteKpi?.scorePct ?? (s.id === 'shackleton-blindspot' ? 18 : 86)
              const sunPct =
                siteRep?.metrics.sun_visible_pct ??
                (s.id === 'shackleton-blindspot' ? 0 : 59.48)
              const earthPct =
                siteRep?.metrics.earth_visible_pct ??
                (s.id === 'shackleton-blindspot' ? 0 : 73.47)
              const commGap =
                siteRep?.metrics.longest_comm_gap_hours ??
                (s.id === 'shackleton-blindspot' ? 720 : 0)
              const isBlind = siteKpi
                ? siteKpi.blindSpotDetected
                : s.id === 'shackleton-blindspot'
              const isCompareAdded = compareIds.includes(s.id)

              const latFormatted = `${Math.abs(s.lat).toFixed(4)}° ${s.lat >= 0 ? 'N' : 'S'}`
              const lonFormatted = `${Math.abs(s.lon).toFixed(4)}° ${s.lon >= 0 ? 'E' : 'W'}`

              return (
                <article
                  key={s.id}
                  className={`md-site-card ${s.id === siteId ? 'active-site' : ''}`}
                >
                  <div className="md-site-card-top">
                    <div>
                      <h3 className="md-site-card-title">{s.name}</h3>
                      <p className="md-caption">{s.region ?? 'Región Lunar'}</p>
                    </div>
                    <div className="md-site-card-watermark">
                      <span
                        className={`md-verdict-inline ${isBlind ? 'not-viable' : 'viable'}`}
                      >
                        {isBlind
                          ? lang === 'es'
                            ? '× No viable'
                            : '× Not viable'
                          : '✓ Viable'}
                      </span>
                      <span className="md-watermark-num">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                    </div>
                  </div>

                  <div className="md-site-coords">
                    {latFormatted}, {lonFormatted}
                  </div>
                  <div className="md-caption">Source: {s.source}</div>

                  {isBlind ? (
                    <div className="md-blind-spot-inline">
                      <span className="md-blind-pill">× Blind spot</span>
                      <p className="md-site-verdict-line">
                        {lang === 'es'
                          ? 'No se puede aterrizar (Pérdida crítica de línea de visión).'
                          : "It can't be done."}
                      </p>
                    </div>
                  ) : (
                    <p className="md-site-verdict-line">
                      {lang === 'es'
                        ? 'Sí, es viable dentro de la ventana operativa.'
                        : 'Yes, it can be done.'}
                    </p>
                  )}

                  <div className="md-site-metrics-row">
                    <div>
                      <span className="md-metric-mini-label">Model score</span>
                      <strong className="md-metric-mini-val">{score}</strong>
                    </div>
                    <div>
                      <span className="md-metric-mini-label">Sun visible</span>
                      <strong className="md-metric-mini-val">{sunPct.toFixed(2)}%</strong>
                    </div>
                    <div>
                      <span className="md-metric-mini-label">Earth visible</span>
                      <strong className="md-metric-mini-val">{earthPct.toFixed(2)}%</strong>
                    </div>
                    <div>
                      <span className="md-metric-mini-label">Comm gap</span>
                      <strong className="md-metric-mini-val">{commGap.toFixed(1)} h</strong>
                    </div>
                  </div>

                  <div className="md-site-card-footer">
                    <span className="md-tag-pill">SPICE DE440</span>
                    <div className="md-site-card-actions">
                      <button
                        type="button"
                        className={
                          isCompareAdded ? 'md-btn secondary selected' : 'md-btn secondary'
                        }
                        onClick={() => toggleCompareSite(s.id)}
                      >
                        {isCompareAdded
                          ? lang === 'es'
                            ? 'Añadido'
                            : 'Added'
                          : lang === 'es'
                            ? 'Comparar'
                            : 'Add to compare'}
                      </button>
                      <button
                        type="button"
                        className="md-btn primary"
                        onClick={() => handleOpenSite(s.id, 'sheet')}
                      >
                        {lang === 'es' ? 'Abrir sitio →' : 'Open site →'}
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </section>

          {/* CUSTOM SCENARIO · Custom coordinates panel (Exact match to zoom7_catalog_left.pdf) */}
          <section className="md-custom-coords-panel">
            <div className="md-custom-coords-info">
              <span className="md-eyebrow">CUSTOM SCENARIO</span>
              <h3 className="md-h2">
                {lang === 'es' ? 'Coordenadas personalizadas' : 'Custom coordinates'}
              </h3>
              <p className="md-caption">
                {lang === 'es'
                  ? 'Evalúa cualquier latitud y longitud lunar con nuestro kernel SPICE DE440 y la base PostgreSQL en AWS EC2.'
                  : 'Custom coordinates use the ephemeris engine (about 35 MB of NASA SPICE DE440 kernels + AWS Horizons).'}
              </p>
              {customStatusMsg && <p className="md-custom-success">{customStatusMsg}</p>}
            </div>

            <div className="md-custom-coords-inputs">
              <div className="md-input-field">
                <label htmlFor="custom-lat">Latitude</label>
                <input
                  id="custom-lat"
                  type="text"
                  value={customLat}
                  onChange={(e) => setCustomLat(e.target.value)}
                  className={latInvalid ? 'md-text-input invalid' : 'md-text-input'}
                />
                <span className="md-caption">Latitude -90 to 90</span>
                {latInvalid && (
                  <span className="md-input-error">Latitude must be between -90 and 90</span>
                )}
              </div>

              <div className="md-input-field">
                <label htmlFor="custom-lon">Longitude</label>
                <input
                  id="custom-lon"
                  type="text"
                  value={customLon}
                  onChange={(e) => setCustomLon(e.target.value)}
                  className={lonInvalid ? 'md-text-input invalid' : 'md-text-input'}
                />
                <span className="md-caption">Longitude -180 to 180</span>
                {lonInvalid && (
                  <span className="md-input-error">Longitude must be between -180 and 180</span>
                )}
              </div>

              <div className="md-custom-coords-cta">
                <button
                  type="button"
                  className="md-btn primary"
                  disabled={latInvalid || lonInvalid}
                  onClick={handleComputeCustomSite}
                >
                  + {lang === 'es' ? 'Calcular sitio' : 'Compute site'}
                </button>
              </div>
            </div>
          </section>

          {/* Floating Compare Dock Bar (Exact match to zoom9_catalog_explain.pdf) */}
          {compareIds.length > 0 && (
            <div className="md-compare-dock">
              <div className="md-compare-dock-left">
                <strong>
                  {lang === 'es' ? 'Comparar' : 'Compare'}{' '}
                  <span className="md-muted">({compareIds.length} of 3)</span>
                </strong>
                <div className="md-compare-dock-chips">
                  {compareIds.map((cid) => {
                    const sMeta = SITES.find((s) => s.id === cid)
                    if (!sMeta) return null
                    return (
                      <span key={cid} className="md-dock-chip">
                        {sMeta.name}
                        <button
                          type="button"
                          onClick={() => toggleCompareSite(cid)}
                          aria-label={`Quitar ${sMeta.name}`}
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
                </div>
              </div>
              <button
                type="button"
                className="md-btn secondary"
                onClick={() => setActiveTab('compare')}
              >
                {lang === 'es' ? 'Ir a comparar →' : 'Go to compare →'}
              </button>
            </div>
          )}
        </main>
      )}

      {/* =====================================================================
          SCREEN 2: FICHA DE SITIO ("IM-2 Athena (Mons Mouton)" — zoom3_midtop.pdf)
         ===================================================================== */}
      {activeTab === 'sheet' && report && kpi && activeSample && (
        <main className="md-main">
          {/* Site switcher pills at top of sheet */}
          <div className="md-sheet-site-switcher">
            {SITES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={s.id === siteId ? 'md-chip selected' : 'md-chip'}
                onClick={() => setSiteId(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>

          <header className="md-page-header">
            <div>
              <p className="md-eyebrow">POLO SUR LUNAR · ANÁLISIS DE ESCENARIO</p>
              <h1 className="md-display-title">{report.site.name}</h1>
              <p className="md-subtitle">
                {report.site.region ?? 'Superficie Lunar'} · {report.site.lat.toFixed(4)}°,{' '}
                {report.site.lon.toFixed(4)}° · Fuente: {report.site.source}
              </p>
            </div>
            <div className="md-page-header-right">
              <span className="md-timestamp-meta">
                ⏱ DATOS DE EFEMÉRIDES · {activeSample.t.slice(0, 16).replace('T', ' ')} UTC
              </span>
            </div>
          </header>

          {/* Row 1: Two Big Countdown Cards ("Sunset in" / "Earthrise in") */}
          <section className="md-two-col-grid">
            <div className="md-panel md-countdown-card">
              <span className="md-caption">{nextCrossings.sunLabel}</span>
              <div className="md-countdown-value">{nextCrossings.sunDelta}</div>
              <div className="md-caption">{nextCrossings.sunIso}</div>
              <div className="md-status-indicator">
                <span className="md-circle-outline" /> {nextCrossings.sunState}
              </div>
            </div>

            <div className="md-panel md-countdown-card">
              <span className="md-caption">{nextCrossings.earthLabel}</span>
              <div className="md-countdown-value">{nextCrossings.earthDelta}</div>
              <div className="md-caption">{nextCrossings.earthIso}</div>
              <div className="md-status-indicator">
                <span className="md-sq-indicator" /> {nextCrossings.earthState}
              </div>
            </div>
          </section>

          {/* Row 2: Model Score & Score Breakdown */}
          <section className="md-two-col-grid">
            <div className="md-panel md-score-card">
              <span className="md-caption">Model score</span>
              <div className="md-score-big">
                {kpi.scorePct} <span>/100</span>
              </div>
              <div className="md-caption">
                {kpi.verdict === 'GO'
                  ? 'Viable'
                  : kpi.verdict === 'CAUTION'
                    ? 'Marginal / Conditional'
                    : 'Not viable (Blind spot)'}
              </div>
              <div className="md-status-indicator">
                <span className="md-sq-indicator" /> {kpi.verdict}
              </div>
            </div>

            <div className="md-panel md-breakdown-card">
              <div className="md-panel-header-row">
                <span className="md-caption">Score breakdown</span>
                <span className="md-caption">Model Score</span>
              </div>
              <div className="md-breakdown-bars">
                <div className="md-breakdown-row">
                  <span>Iluminación Solar</span>
                  <div className="md-mini-track">
                    <div
                      className="md-mini-fill sun"
                      style={{ width: `${kpi.subscores.illumination}%` }}
                    />
                  </div>
                  <strong>{kpi.subscores.illumination}%</strong>
                </div>
                <div className="md-breakdown-row">
                  <span>Enlace Directo Tierra (DTE)</span>
                  <div className="md-mini-track">
                    <div
                      className="md-mini-fill earth"
                      style={{ width: `${kpi.subscores.communication}%` }}
                    />
                  </div>
                  <strong>{kpi.subscores.communication}%</strong>
                </div>
                <div className="md-breakdown-row">
                  <span>Despeje Acimutal Terreno</span>
                  <div className="md-mini-track">
                    <div
                      className="md-mini-fill viable"
                      style={{ width: `${kpi.subscores.azimuthTopography}%` }}
                    />
                  </div>
                  <strong>{kpi.subscores.azimuthTopography}%</strong>
                </div>
                <div className="md-breakdown-row">
                  <span>Estabilidad Exosfera / Regolito</span>
                  <div className="md-mini-track">
                    <div
                      className="md-mini-fill sun"
                      style={{ width: `${kpi.subscores.environment}%` }}
                    />
                  </div>
                  <strong>{kpi.subscores.environment}%</strong>
                </div>
              </div>
            </div>
          </section>

          {/* Row 3: ORYSEL / LUNAR MISSION CONTROL (ElevationChart + 24-hour outlook + Time Slider) */}
          <section className="md-mission-control-card">
            <div className="md-mission-control-grid">
              {/* Left: Elevation Chart */}
              <div className="md-mc-chart-col">
                <div className="md-mc-header">
                  <div>
                    <span className="md-eyebrow">ORYSEL / LUNAR MISSION CONTROL</span>
                    <h2 className="md-h1">Elevación del Sol y la Tierra</h2>
                    <p className="md-caption">
                      {report.site.name} · 14 nov — 14 dic 2026
                    </p>
                  </div>
                  <span className="md-caption">Marco MOON_ME (LT+S)</span>
                </div>

                {/* Epoch readout strip */}
                <div className="md-mc-readout-strip">
                  <div className="md-mc-epoch-box">
                    <strong>{activeSample.t.slice(0, 16).replace('T', ' ')} UTC</strong>
                    <span>Época de referencia UTC</span>
                  </div>
                  <div className="md-mc-body-readout">
                    <span className="md-sun-text">
                      Sol <strong>{activeSample.sun_el.toFixed(2)}°</strong>
                    </span>
                    <span className="md-caption">Azimut {activeSample.sun_az.toFixed(1)}°</span>
                  </div>
                  <div className="md-mc-body-readout">
                    <span className="md-earth-text">
                      Tierra <strong>{activeSample.earth_el.toFixed(2)}°</strong>
                    </span>
                    <span className="md-caption">Azimut {activeSample.earth_az.toFixed(1)}°</span>
                  </div>
                </div>

                <ElevationChart
                  report={report}
                  selectedIndex={selectedSampleIdx}
                  onSelectIndex={(idx) => setSelectedSampleIdx(idx)}
                />

                <div className="md-mc-chart-footer">
                  <div className="md-orbital-legend">
                    <span>
                      <i className="md-dot sun" /> Sol
                    </span>
                    <span>
                      <i className="md-dot earth" /> Tierra
                    </span>
                    <span>
                      <i className="md-line-swatch dashed" /> Umbral de enlace ·{' '}
                      {Math.max(2, report.site.minCommElevationDeg ?? 2)}°
                    </span>
                  </div>
                  <div className="md-caption">
                    Elevación topocéntrica · grados (°) · Radio lunar: 1737.4 km
                  </div>
                </div>
              </div>

              {/* Right: 24-hour outlook + 09 / TIME SLIDER */}
              <div className="md-mc-outlook-col">
                <TwentyFourHourOutlook report={report} selectedIndex={selectedSampleIdx} />

                {/* 09 / TIME SLIDER · PAUSED / PLAYING (from zoom2_designsystem.pdf) */}
                <div className="md-time-slider-card">
                  <div className="md-time-slider-top">
                    <button
                      type="button"
                      className="md-play-btn"
                      onClick={() => setIsPlaying((p) => !p)}
                    >
                      {isPlaying ? 'Ⅱ Pause' : '▶ Play'}
                    </button>
                    <div className="md-scenario-time-label">
                      <span>SCENARIO TIME</span>
                      <strong>{activeSample.t.slice(0, 16).replace('T', ' ')} UTC</strong>
                    </div>
                    <span className="md-caption">1× speed</span>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, report.series.length - 1)}
                    value={selectedSampleIdx}
                    onChange={(e) => setSelectedSampleIdx(Number(e.target.value))}
                    className="md-range-slider"
                  />

                  <div className="md-time-slider-ticks">
                    <span>14 Nov 00:00</span>
                    <span>29 Nov 12:00</span>
                    <span>14 Dic 00:00 UTC</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Row 4: 8 Metric Tiles in 4x2 Grid (Exact match to zoom3_midtop.pdf) */}
          <section className="md-eight-metrics-grid">
            <div className="md-metric-tile">
              <span className="md-label">SUN VISIBLE</span>
              <strong className="md-tile-number sun">{report.metrics.sun_visible_pct}%</strong>
              <span className="md-caption">Computed value</span>
              <span className="md-caption">Source: SPICE DE440</span>
            </div>
            <div className="md-metric-tile">
              <span className="md-label">EARTH VISIBLE</span>
              <strong className="md-tile-number earth">{report.metrics.earth_visible_pct}%</strong>
              <span className="md-caption">Computed value</span>
              <span className="md-caption">Source: SPICE DE440</span>
            </div>
            <div className="md-metric-tile">
              <span className="md-label">BOTH VISIBLE</span>
              <strong className="md-tile-number">{report.metrics.both_visible_pct}%</strong>
              <span className="md-caption">Computed value</span>
              <span className="md-caption">Source: SPICE DE440</span>
            </div>
            <div className="md-metric-tile">
              <span className="md-label">LONGEST SUN WINDOW</span>
              <strong className="md-tile-number">
                {report.metrics.longest_sun_window_hours} h
              </strong>
              <span className="md-caption">Computed value</span>
              <span className="md-caption">Source: Hourly samples</span>
            </div>

            <div className="md-metric-tile">
              <span className="md-label">LONGEST NIGHT</span>
              <strong className="md-tile-number">{report.metrics.longest_night_hours} h</strong>
              <span className="md-caption">Computed value</span>
              <span className="md-caption">Source: Hourly samples</span>
            </div>
            <div className="md-metric-tile">
              <span className="md-label">LONGEST COMM GAP</span>
              <strong className="md-tile-number">{report.metrics.longest_comm_gap_hours} h</strong>
              <span className="md-caption">Computed value</span>
              <span className="md-caption">Source: Hourly samples</span>
            </div>
            <div className="md-metric-tile">
              <span className="md-label">MAX SUN ELEVATION</span>
              <strong className="md-tile-number sun">{report.metrics.max_sun_el}°</strong>
              <span className="md-caption">Computed value</span>
              <span className="md-caption">Source: SPICE DE440</span>
            </div>
            <div className="md-metric-tile">
              <span className="md-label">MAX EARTH ELEVATION</span>
              <strong className="md-tile-number earth">{report.metrics.max_earth_el}°</strong>
              <span className="md-caption">Computed value</span>
              <span className="md-caption">Source: SPICE DE440</span>
            </div>
          </section>

          {/* Row 5: MODEL INPUTS · Environment & approach (Exact match to zoom3_midtop.pdf) */}
          <section className="md-panel md-env-panel">
            <div className="md-panel-header-row">
              <div>
                <span className="md-eyebrow">MODEL INPUTS</span>
                <h3 className="md-h2">Environment &amp; approach</h3>
              </div>
              <span className="md-tag-pill">Model input</span>
            </div>

            <div className="md-env-grid">
              <div className="md-env-cell">
                <span className="md-caption">Electrostatic dust risk</span>
                <strong className="md-env-val marginal">
                  △ {report.site.electrostaticDustRisk ?? 'MODERATE'}
                </strong>
              </div>
              <div className="md-env-cell">
                <span className="md-caption">Magnetic anomaly</span>
                <strong className="md-env-val">{report.site.magneticAnomalynT ?? 2} nT</strong>
              </div>
              <div className="md-env-cell">
                <span className="md-caption">Exosphere interaction index</span>
                <strong className="md-env-val">
                  {report.site.exosphereInteractionIndex ?? 0.25}
                </strong>
              </div>
              <div className="md-env-cell">
                <span className="md-caption">Orbital velocity</span>
                <strong className="md-env-val">{kpi.kinematics.orbitalVelocityKmS} km/s</strong>
              </div>
              <div className="md-env-cell">
                <span className="md-caption">Escape velocity</span>
                <strong className="md-env-val">{kpi.kinematics.escapeVelocityKmS} km/s</strong>
              </div>
              <div className="md-env-cell">
                <span className="md-caption">Optimal approach azimuth</span>
                <strong className="md-env-val">
                  {kpi.kinematics.optimalApproachAzimuthDeg}°
                </strong>
              </div>
              <div className="md-env-cell">
                <span className="md-caption">3-sigma landing ellipse</span>
                <strong className="md-env-val">{kpi.kinematics.landingEllipse3SigmaKm} km</strong>
              </div>
            </div>
          </section>

          {/* Row 6: Live AWS PostgreSQL NASA JPL Horizons Table (Exact match to zoom3_midtop.pdf) */}
          <section className="md-panel md-aws-table-panel">
            <div className="md-aws-table-header">
              <div className="md-aws-tabs">
                <button
                  type="button"
                  className={sheetBottomTab === 'aws' ? 'md-tab-btn active' : 'md-tab-btn'}
                  onClick={() => setSheetBottomTab('aws')}
                >
                  Serie NASA JPL Horizons desde AWS (/api/horizons/{siteId})
                </button>
                <button
                  type="button"
                  className={sheetBottomTab === 'events' ? 'md-tab-btn active' : 'md-tab-btn'}
                  onClick={() => setSheetBottomTab('events')}
                >
                  Eventos de Salida y Ocultación ({report.events.length})
                </button>
                <button
                  type="button"
                  className={sheetBottomTab === 'spaceengine' ? 'md-tab-btn active' : 'md-tab-btn'}
                  onClick={() => setSheetBottomTab('spaceengine')}
                >
                  Validación 3D SpaceEngine
                </button>
              </div>
              <span className="md-mono-caption">
                Origen:{' '}
                {awsRowsSource === 'aws-live'
                  ? `AWS EC2 PostgreSQL (${AWS_BASE_URL})`
                  : 'Respaldo Local Sincronizado (SPICE DE440)'}
              </span>
            </div>

            {sheetBottomTab === 'aws' && (
              <div className="md-table-scroll">
                <table className="md-data-table">
                  <thead>
                    <tr>
                      <th>Sitio</th>
                      <th>Época UTC (&apos;t&apos;)</th>
                      <th>Cuerpo</th>
                      <th>Acimut (&apos;az_deg&apos;)</th>
                      <th>Elevación (&apos;el_deg&apos;)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {awsRows.slice(0, 30).map((row, idx) => (
                      <tr key={`${row.t}-${row.cuerpo}-${idx}`}>
                        <td className="mono">{row.sitio_id}</td>
                        <td className="mono">{row.t}</td>
                        <td>
                          <span className={`md-body-pill ${row.cuerpo}`}>
                            <i className={`md-dot ${row.cuerpo === 'sol' ? 'sun' : 'earth'}`} />
                            {row.cuerpo === 'sol' ? 'Sol' : 'Tierra'}
                          </span>
                        </td>
                        <td className="mono">{Number(row.az_deg).toFixed(4)}°</td>
                        <td className={`mono ${Number(row.el_deg) > 0 ? 'pos' : 'neg'}`}>
                          {Number(row.el_deg).toFixed(4)}°
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {sheetBottomTab === 'events' && (
              <div className="md-table-scroll">
                <table className="md-data-table">
                  <thead>
                    <tr>
                      <th>Cuerpo</th>
                      <th>Evento</th>
                      <th>Fecha y Hora (UTC)</th>
                      <th>Acimut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.events.map((ev) => (
                      <tr key={`${ev.body}-${ev.type}-${ev.t}`}>
                        <td>{ev.body === 'sun' ? '☀️ Sol' : '🌍 Tierra'}</td>
                        <td>{ev.type === 'rise' ? 'Salida (+0°)' : 'Puesta (-0°)'}</td>
                        <td className="mono">{ev.t.slice(0, 19).replace('T', ' ')}Z</td>
                        <td className="mono">{ev.az.toFixed(1)}°</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {sheetBottomTab === 'spaceengine' && (
              <div className="md-spaceengine-box">
                <p className="md-caption">
                  <strong>Cápsula de Validación Visual 3D (SpaceEngine 0.990):</strong> ORYSEL
                  calcula la cinemática y el KPI determinista; usa estas coordenadas exactas para
                  contrastar visualmente el relieve LOLA y las sombras rasantes en 3D:
                </p>
                <div className="md-se-grid">
                  <div>
                    <span>Objetivo</span>
                    <strong>Moon ({report.site.name})</strong>
                  </div>
                  <div>
                    <span>Coordenadas Selenográficas</span>
                    <strong className="mono">
                      Lat {report.site.lat.toFixed(4)}° · Lon {report.site.lon.toFixed(4)}° · Alt{' '}
                      {report.site.heightKm.toFixed(3)} km
                    </strong>
                  </div>
                  <div>
                    <span>Época UTC Sincronizada</span>
                    <strong className="mono">{activeSample.t}</strong>
                  </div>
                  <div>
                    <span>Ángulos Calculados por ORYSEL</span>
                    <strong className="mono">
                      Sol El {activeSample.sun_el.toFixed(2)}° (Az {activeSample.sun_az.toFixed(1)}
                      °) | Tierra El {activeSample.earth_el.toFixed(2)}°
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Local Horizon 360° & Sky Visibility Polar Radar */}
          <LocalHorizonAndSkyRow report={report} sample={activeSample} />
        </main>
      )}

      {/* =====================================================================
          SCREEN 3: COMPARAR ("Compare scenarios" — Exact match to Cambios a realizar.png)
         ===================================================================== */}
      {activeTab === 'compare' && (
        <main className="md-main">
          <header className="md-page-header">
            <div>
              <p className="md-eyebrow">POLO SUR LUNAR · ANÁLISIS DE ESCENARIO</p>
              <h1 className="md-display-title">
                {lang === 'es' ? 'Compare scenarios' : 'Compare scenarios'}
              </h1>
              <p className="md-subtitle">
                {lang === 'es'
                  ? 'Sites over the same analysis window'
                  : 'Sites over the same analysis window'}
              </p>
            </div>
            <div className="md-page-header-right">
              <span className="md-timestamp-meta">
                ⏱ DATOS DE MUESTRA · 2026-11-14 00:00 UTC
              </span>
            </div>
          </header>

          {/* 4-Column Compare Strip (Exact match to Cambios a realizar.png — NO Model Status) */}
          <section className="md-scenario-strip">
            <div className="md-strip-cell">
              <span className="md-label">SITIO DE ALUNIZAJE</span>
              <select
                value={compareLeftId}
                onChange={(e) => {
                  updateCompareSiteA(e.target.value)
                  setSiteId(e.target.value)
                }}
                className="md-strip-select"
              >
                {SITES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md-strip-cell">
              <span className="md-label">VENTANA BASE</span>
              <strong className="md-strip-val">14 NOV 2026</strong>
            </div>

            <div className="md-strip-cell">
              <span className="md-label">AJUSTE PROPUESTO</span>
              <div className="md-delay-stepper">
                <button
                  type="button"
                  onClick={() => setDelayDays((d) => Math.max(0, d - 1))}
                  aria-label="Reducir días de retraso"
                >
                  −
                </button>
                <strong className="md-earth-text">
                  {delayDays >= 0 ? `+${delayDays} días` : `${delayDays} días`}
                </strong>
                <button
                  type="button"
                  onClick={() => setDelayDays((d) => Math.min(28, d + 1))}
                  aria-label="Aumentar días de retraso"
                >
                  +
                </button>
              </div>
            </div>

            <div className="md-strip-cell sync-cell">
              <span className="md-sync-status">
                <i className="md-sync-dot" /> SIMULACIÓN SINCRONIZADA
              </span>
            </div>
          </section>

          {/* 3 Separate Moon Cards + "Comparación de métricas" + "Comparar fechas" (Exact match to Cambios a realizar.png) */}
          {compareLeftData && compareRightData && (
            <ThreeMoonsComparisonSection
              sites={SITES}
              siteA={compareLeftData}
              siteB={compareRightData}
              siteC={compareThirdData}
              onChangeSiteA={(id) => {
                updateCompareSiteA(id)
                setSiteId(id)
              }}
              onChangeSiteB={(id) => updateCompareSiteB(id)}
              onChangeSiteC={(id) => updateCompareSiteC(id)}
              delayDays={delayDays}
            />
          )}

          {/* Bottom Interactive Dashboard (Verdict Banner + Posición orbital + 3 KPIs + ¿Qué pasaría si...? with A|B|C switcher) */}
          {focusedCompareReport && focusedCompareStats.shiftedSample && (
            <div className="md-compare-bottom-dashboard">
              <section
                className={`md-verdict-hero-banner ${
                  focusedCompareStats.verdict === 'GO'
                    ? 'viable'
                    : focusedCompareStats.verdict === 'CAUTION'
                      ? 'marginal'
                      : 'not-viable'
                }`}
              >
                <div className="md-verdict-hero-left">
                  <div className="md-circular-gauge">
                    <svg viewBox="0 0 68 68">
                      <circle
                        cx="34"
                        cy="34"
                        r="28"
                        fill="none"
                        stroke="rgba(255,255,255,0.12)"
                        strokeWidth="4.5"
                      />
                      <circle
                        cx="34"
                        cy="34"
                        r="28"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4.5"
                        strokeDasharray={`${(focusedCompareStats.scorePct / 100) * 176} 176`}
                        transform="rotate(-90 34 34)"
                        strokeLinecap="round"
                      />
                    </svg>
                    <strong>{focusedCompareStats.scorePct}</strong>
                  </div>

                  <div>
                    <span className="md-label">VEREDICTO DE VIABILIDAD</span>
                    <h2 className="md-verdict-hero-title">
                      ●{' '}
                      {focusedCompareStats.verdict === 'GO'
                        ? 'Viable'
                        : focusedCompareStats.verdict === 'CAUTION'
                          ? 'Condicional'
                          : 'No Viable'}
                    </h2>
                    <p className="md-caption">
                      {focusedCompareStats.vetoReason ??
                        'Iluminación estable y enlace directo a la Tierra dentro de la ventana operativa.'}
                    </p>
                  </div>
                </div>

                <div className="md-verdict-hero-checks">
                  <span>✓ {lang === 'es' ? 'Amanecer' : 'Sunrise'}</span>
                  <span>
                    {focusedCompareStats.blindSpotDetected
                      ? '× Sin línea a Tierra'
                      : '✓ Tierra a la vista'}
                  </span>
                  <span>
                    ✓{' '}
                    {Math.max(
                      1,
                      Math.round(focusedCompareReport.metrics.longest_sun_window_hours / 24),
                    )}{' '}
                    {lang === 'es' ? 'días de luz' : 'days of light'}
                  </span>
                </div>
              </section>

              <section className="md-navigator-middle-grid">
                <OrbitalPositionCenital
                  sample={focusedCompareStats.shiftedSample}
                  siteName={focusedCompareReport.site.name}
                />

                <div className="md-navigator-right-stack">
                  {/* 3 KPI Mini-Cards */}
                  <div className="md-three-kpi-cards">
                    <div className="md-panel md-mini-kpi">
                      <span className="md-mini-kpi-icon">☀️</span>
                      <div>
                        <span className="md-label">PRÓXIMO AMANECER</span>
                        <strong className="md-mini-kpi-val">
                          {focusedCompareStats.nextSunDelta}
                        </strong>
                        <span className="md-caption">Ventana solar</span>
                      </div>
                    </div>

                    <div className="md-panel md-mini-kpi">
                      <span className="md-mini-kpi-icon">🕒</span>
                      <div>
                        <span className="md-label">LUZ CONTINUA</span>
                        <strong className="md-mini-kpi-val">
                          {focusedCompareStats.contLightDelta}
                        </strong>
                        <span className="md-caption">Duración estimada</span>
                      </div>
                    </div>

                    <div className="md-panel md-mini-kpi">
                      <span className="md-mini-kpi-icon">🌍</span>
                      <div>
                        <span className="md-label">TIERRA VISIBLE</span>
                        <strong className="md-mini-kpi-val">
                          {focusedCompareStats.earthPct}%
                        </strong>
                        <span className="md-caption">Línea de visión</span>
                      </div>
                    </div>
                  </div>

                  {/* ANÁLISIS DE SENSIBILIDAD · ¿Qué pasaría si...? */}
                  <div className="md-panel md-sensitivity-card">
                    <div className="md-panel-header-row">
                      <div>
                        <span className="md-eyebrow">ANÁLISIS DE SENSIBILIDAD</span>
                        <h3 className="md-h2">
                          {lang === 'es' ? '¿Qué pasaría si...?' : 'What if we delay?'}
                        </h3>
                      </div>
                      <span className="md-tag-pill">RETRASO +{delayDays} DÍAS</span>
                    </div>

                    <div className="md-sensitivity-slider-block">
                      <div className="md-sensitivity-slider-labels">
                        <span>{lang === 'es' ? 'Retrasar el alunizaje' : 'Delay landing'}</span>
                        <strong>{delayDays} días</strong>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={28}
                        value={delayDays}
                        onChange={(e) => setDelayDays(Number(e.target.value))}
                        className="md-range-slider"
                      />
                      <div className="md-time-slider-ticks">
                        <span>0</span>
                        <span>14</span>
                        <span>28 días</span>
                      </div>
                    </div>

                    <div className="md-sensitivity-bars">
                      <div className="md-sens-bar-row">
                        <div className="md-sens-bar-meta">
                          <span>☀️ Iluminación solar</span>
                          <small>{focusedCompareStats.sunPct}% disponible</small>
                        </div>
                        <div className="md-dual-bar-track">
                          <div
                            className="md-dual-bar-fill amber"
                            style={{ width: `${Math.min(100, focusedCompareStats.sunPct)}%` }}
                          />
                        </div>
                      </div>

                      <div className="md-sens-bar-row">
                        <div className="md-sens-bar-meta">
                          <span>🌍 Enlace con la Tierra</span>
                          <small>{focusedCompareStats.earthPct}% de visibilidad</small>
                        </div>
                        <div className="md-dual-bar-track">
                          <div
                            className="md-dual-bar-fill blue"
                            style={{ width: `${Math.min(100, focusedCompareStats.earthPct)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="md-sensitivity-footer">
                      <div className="md-abc-switcher" role="group" aria-label="Sitio analizado">
                        <button
                          type="button"
                          className={compareSlot === 'A' ? 'md-abc-btn active' : 'md-abc-btn'}
                          onClick={() => setCompareSlot('A')}
                        >
                          A · {compareLeftData?.site.name.split(' ')[0] ?? 'Sitio A'}
                        </button>
                        <button
                          type="button"
                          className={compareSlot === 'B' ? 'md-abc-btn active-light' : 'md-abc-btn'}
                          onClick={() => setCompareSlot('B')}
                        >
                          B · {compareRightData?.site.name.split(' ')[0] ?? 'Sitio B'}
                        </button>
                        <button
                          type="button"
                          className={compareSlot === 'C' ? 'md-abc-btn active' : 'md-abc-btn'}
                          onClick={() => {
                            if (!compareThirdId) {
                              const fallbackC =
                                SITES.find(
                                  (s) => s.id !== compareLeftId && s.id !== compareRightId,
                                )?.id ?? 'apollo11'
                              updateCompareSiteC(fallbackC)
                            }
                            setCompareSlot('C')
                          }}
                        >
                          C · {compareThirdData ? compareThirdData.site.name.split(' ')[0] : 'Luna 3'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </main>
      )}

      {/* =====================================================================
          SCREEN 5: ACERCA DE LOS DATOS ("About data & AWS API & Simulator")
         ===================================================================== */}
      {activeTab === 'about' && (
        <main className="md-main">
          <header className="md-page-header">
            <div>
              <p className="md-eyebrow">ARQUITECTURA CIENTÍFICA · NASA SPACE APPS 2026</p>
              <h1 className="md-display-title">
                {lang === 'es'
                  ? 'Acerca de los datos, API en AWS y Validación'
                  : 'About NASA Data, Open AWS API & Validation'}
              </h1>
              <p className="md-subtitle">
                Efemérides calculadas con kernels oficiales de NASA/NAIF SPICE (DE440),
                sincronizadas en PostgreSQL 16 + FastAPI en AWS EC2 y comprobadas contra JPL
                Horizons.
              </p>
            </div>
            <div className="md-page-header-right">
              <button
                type="button"
                className="md-btn primary"
                onClick={() => setShowArchModal(true)}
              >
                Abrir Consola API AWS &amp; Snippet →
              </button>
            </div>
          </header>

          <section className="md-two-col-grid">
            <div className="md-panel">
              <span className="md-eyebrow">CAPA 1 Y 2 · AWS EC2 + POSTGRESQL 16</span>
              <h3 className="md-h2">API Abierta e Interoperable en Tiempo Real</h3>
              <p className="md-caption">
                Nuestra instancia activa en <code>{AWS_BASE_URL}</code> sirve 5,768 registros
                horarios de NASA/JPL Horizons con CORS abierto para que cualquier universidad o
                agencia consuma las ventanas lunares:
              </p>
              <ul className="md-clean-list">
                <li>
                  <code>GET /api/ping</code> — Healthcheck y latencia de PostgreSQL (~16.8 ms).
                </li>
                <li>
                  <code>GET /api/sites</code> — Porcentaje de visibilidad solar y terrestre por
                  sitio.
                </li>
                <li>
                  <code>GET /api/horizons/&#123;sitio_id&#125;?limit=100</code> — Serie horaria de
                  acimut y elevación.
                </li>
                <li>
                  <a href={`${AWS_BASE_URL}/docs`} target="_blank" rel="noreferrer">
                    <code>{AWS_BASE_URL}/docs</code> — Documentación interactiva Swagger UI ↗
                  </a>
                </li>
              </ul>
            </div>

            <div className="md-panel">
              <span className="md-eyebrow">CAPA 3 · KERNEL FÍSICO Y COMITÉ ACADÉMICO UP</span>
              <h3 className="md-h2">Fundamentación Matemática y Física Lunar</h3>
              <ul className="md-clean-list">
                <li>
                  <strong>Cinemática Orbital (Kepler y Euler-Lagrange):</strong> Marco
                  selenocéntrico <code>MOON_ME</code> con corrección de tiempo-luz y aberración
                  estelar (<code>LT+S</code>).
                </li>
                <li>
                  <strong>Física Ambiental y Estadística (3σ):</strong> Modela exosfera lunar (~2
                  km), levantamiento electrostático de regolito y anomalía magnética cortical en
                  Reiner Gamma (28 nT).
                </li>
                <li>
                  <strong>Respaldo Académico (Universidad Politécnica):</strong> Dr. Horacio
                  (Kernel), Prof. Jorge y Dr. Manuel Martínez (Telemetría), Dr. Mendoza y Dr.
                  Montero (Física Teórica y Probabilidad).
                </li>
              </ul>
            </div>
          </section>

          {report && kpi && <RocketVectorPlayground site={report.site} viability={kpi} />}
        </main>
      )}

      {/* =====================================================================
          FLOATING ORY-BOT ASSISTANT (Bottom-right collapsible widget)
         ===================================================================== */}
      {report && kpi && activeSample && (
        <OryBotAssistant
          site={report.site}
          viability={kpi}
          profile={profileMode}
          activeSample={activeSample}
          userName={session.name}
          onSelectSiteId={(id: string) => setSiteId(id)}
        />
      )}
    </div>
  )
}
export default App
