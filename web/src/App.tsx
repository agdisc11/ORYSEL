import { useEffect, useMemo, useRef, useState } from 'react'
import { SITES, localizeSite } from './data/sites.ts'
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
  PedagogicalSkyChart,
  ThreeMoonsComparisonSection,
  TwentyFourHourOutlook,
} from './components/LunarVisualWidgets.tsx'
import {
  AuthError,
  computeCustomReport,
  fetchReport,
  fetchValidation,
  type AuthUser,
  type ValidationSummary,
} from './ephemeris/authApi.ts'
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

/** Id of the point computed from "Coordenadas personalizadas". */
const CUSTOM_SITE_ID = 'custom'

function formatDurationHours(hours: number): string {
  if (hours <= 0) return '0 h'
  // Round the total first so 47.99 h reads "2d 00h", not "1d 24h"
  const total = Math.round(hours)
  const days = Math.floor(total / 24)
  const remH = total % 24
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

function dustRiskLabel(risk: Site['electrostaticDustRisk'], lang: Lang): string {
  if (!risk) return '—'
  const es = { LOW: 'Bajo', MODERATE: 'Moderado', HIGH: 'Alto' } as const
  const en = { LOW: 'Low', MODERATE: 'Moderate', HIGH: 'High' } as const
  return (lang === 'es' ? es : en)[risk]
}

function translateRegion(region: string | undefined, lang: Lang): string {
  if (!region) return lang === 'es' ? 'Superficie lunar' : 'Lunar surface'
  return region // already in the chosen language (localizeSite)
}

function translateSiteDescription(site: Site, lang: Lang): string {
  return (
    site.description ??
    (lang === 'es'
      ? 'Sitio lunar calculado con SPICE DE440 (NASA/NAIF).'
      : 'Lunar site computed with SPICE DE440 (NASA/NAIF).')
  )
}

interface AppProps {
  /** Signed-in account; the app is only rendered behind AuthGate. */
  user: AuthUser
  onSignOut: () => void
}

export function App({ user, onSignOut }: AppProps) {
  const [siteId, setSiteId] = useState<string>(SITES[0].id)
  const [compareIds, setCompareIds] = useState<string[]>(['im2', 'reiner-gamma'])
  const [compareSlot, setCompareSlot] = useState<CompareSlot>('A')
  const [activeTab, setActiveTab] = useState<MainTab>('catalog')
  const [lang, setLang] = useState<Lang>('es')
  const langRef = useRef<Lang>(lang)
  langRef.current = lang
  const sites = useMemo(() => SITES.map((s) => localizeSite(s, lang)), [lang])
  const [explainOpen, setExplainOpen] = useState<boolean>(false)
  const [profileMode, setProfileMode] = useState<UserProfileMode>('executive')

  // Catalog filters & Custom coordinates
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all')
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>('all')
  const [customLat, setCustomLat] = useState<string>('-84.79')
  const [customLon, setCustomLon] = useState<string>('29.20')
  const [customStatusMsg, setCustomStatusMsg] = useState<string | null>(null)
  const [customReport, setCustomReport] = useState<SiteReport | null>(null)
  const [computingCustom, setComputingCustom] = useState<boolean>(false)
  const [validation, setValidation] = useState<ValidationSummary | null>(null)

  // All 4 sites preloaded so Catalog & Compare show live SPICE DE440 + AWS metrics
  const [allSitesData, setAllSitesData] = useState<Record<string, LoadedSiteData>>({})
  const [report, setReport] = useState<SiteReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedSampleIdx, setSelectedSampleIdx] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)

  // Sensitivity ("¿Qué pasaría si...?") & Compare delay slider (days)
  const [delayDays, setDelayDays] = useState<number>(2)

  // Modals & sub-tabs
  const [accountMenuOpen, setAccountMenuOpen] = useState<boolean>(false)
  const [showArchModal, setShowArchModal] = useState<boolean>(false)
  const [sheetBottomTab, setSheetBottomTab] = useState<'aws' | 'events'>('aws')

  // Close the account menu on Escape or a click outside it
  useEffect(() => {
    if (!accountMenuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountMenuOpen(false)
    }
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest('.md-account')) setAccountMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [accountMenuOpen])

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
        const data = await fetchReport(meta.id)
        const mergedSite = localizeSite({ ...meta, ...data.site }, langRef.current)
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
    const meta = SITES.find((s) => s.id === siteId)
    const load =
      siteId === CUSTOM_SITE_ID && customReport
        ? Promise.resolve(customReport)
        : fetchReport(siteId)

    load
      .then((data) => {
        if (cancelled) return
        const mergedSite = localizeSite(
          meta ? { ...meta, ...data.site } : data.site,
          langRef.current,
        )
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
  }, [siteId, customReport])

  // Switch the site text (names, regions, descriptions) when the language changes
  useEffect(() => {
    setReport((r) => (r ? { ...r, site: localizeSite(r.site, lang) } : r))
    setCustomReport((r) => (r ? { ...r, site: localizeSite(r.site, lang) } : r))
    setAllSitesData((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([k, v]) => [
          k,
          {
            ...v,
            meta: localizeSite(v.meta, lang),
            report: { ...v.report, site: localizeSite(v.report.site, lang) },
          },
        ]),
      ),
    )
  }, [lang])

  // Measured agreement with NASA/JPL Horizons (scripts/horizons.ts), for "About the data"
  useEffect(() => {
    fetchValidation()
      .then(setValidation)
      .catch(() => setValidation(null))
  }, [])

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
    return sites.filter((s) => {
      const q = searchQuery.trim().toLowerCase()
      const regText = (s.region ?? '').toLowerCase()
      if (
        q &&
        !s.name.toLowerCase().includes(q) &&
        !regText.includes(q) &&
        !s.source.toLowerCase().includes(q)
      ) {
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
  }, [sites, searchQuery, regionFilter, verdictFilter, allSitesData])

  // Custom coordinates validation
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

  // Compare view Site A, Site B, and optional Site C
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
      newId
        ? [prev[0] ?? 'im2', prev[1] ?? 'reiner-gamma', newId]
        : [prev[0] ?? 'im2', prev[1] ?? 'reiner-gamma'],
    )
  }

  const handleComputeCustomSite = async () => {
    if (latInvalid || lonInvalid || computingCustom) return
    const es = lang === 'es'
    setComputingCustom(true)
    setCustomStatusMsg(
      es
        ? 'Calculando con SPICE DE440 en el servidor…'
        : 'Computing with SPICE DE440 on the server…',
    )
    const t0 = performance.now()
    try {
      const rep = await computeCustomReport(parsedLat, parsedLon)
      const secs = ((performance.now() - t0) / 1000).toFixed(1)
      setCustomReport(rep)
      setAllSitesData((prev) => ({ ...prev, [CUSTOM_SITE_ID]: { meta: rep.site, report: rep } }))
      setSiteId(CUSTOM_SITE_ID)
      setActiveTab('sheet')
      setCustomStatusMsg(
        es
          ? `Calculado con SPICE DE440 para (${parsedLat.toFixed(2)}°, ${parsedLon.toFixed(2)}°) en ${secs} s. Horizonte liso: todavía sin relieve.`
          : `Computed with SPICE DE440 for (${parsedLat.toFixed(2)}°, ${parsedLon.toFixed(2)}°) in ${secs} s. Smooth horizon: no terrain yet.`,
      )
    } catch (error) {
      const code = error instanceof AuthError ? error.code : 'server'
      setCustomStatusMsg(
        code === 'throttled'
          ? es
            ? 'Hiciste muchos cálculos seguidos. Espera unos minutos.'
            : 'Too many calculations in a row. Wait a few minutes.'
          : code === 'network'
            ? es
              ? 'No hay conexión con el servidor. Inténtalo de nuevo.'
              : 'No connection to the server. Try again.'
            : es
              ? 'El cálculo no se pudo completar. Inténtalo de nuevo en un momento.'
              : 'The calculation could not finish. Try again in a moment.',
      )
    } finally {
      setComputingCustom(false)
    }
  }

  // Next Sun and Earth horizon crossings after the selected instant (from the SPICE events)
  const nextCrossings = useMemo(() => {
    const es = lang === 'es'
    if (!report || !activeSample) {
      return {
        sunLabel: '',
        sunDelta: '—',
        sunIso: '—',
        sunState: '',
        sunNext: null,
        earthLabel: '',
        earthDelta: '—',
        earthIso: '—',
        earthState: '',
        earthNext: null,
      }
    }
    const nowMs = Date.parse(activeSample.t)
    const next = (body: 'sun' | 'earth') =>
      report.events.find((ev) => ev.body === body && Date.parse(ev.t) > nowMs) ?? null
    const sunNext = next('sun')
    const earthNext = next('earth')
    const label = (ev: typeof sunNext, body: 'sun' | 'earth') => {
      if (!ev) return es ? (body === 'sun' ? 'Sol' : 'Tierra') : body === 'sun' ? 'Sun' : 'Earth'
      if (ev.type === 'rise') {
        return es
          ? body === 'sun'
            ? 'Amanecer en'
            : 'Salida de la Tierra en'
          : body === 'sun'
            ? 'Sunrise in'
            : 'Earthrise in'
      }
      return es
        ? body === 'sun'
          ? 'Atardecer en'
          : 'La Tierra se oculta en'
        : body === 'sun'
          ? 'Sunset in'
          : 'Earthset in'
    }
    const delta = (ev: typeof sunNext) =>
      ev
        ? formatDurationHours(Math.max(1, (Date.parse(ev.t) - nowMs) / 3_600_000))
        : es
          ? 'Sin cambios'
          : 'No change'
    const iso = (ev: typeof sunNext) =>
      ev
        ? `${ev.t.slice(0, 16).replace('T', ' ')} UTC`
        : es
          ? 'No sale ni se pone antes del fin de la ventana'
          : 'No rise or set before the window ends'
    const state = (visible: boolean) =>
      visible
        ? es
          ? 'Sobre el horizonte'
          : 'Above the horizon'
        : es
          ? 'Bajo el horizonte'
          : 'Below the horizon'
    return {
      sunLabel: label(sunNext, 'sun'),
      sunDelta: delta(sunNext),
      sunIso: iso(sunNext),
      sunState: state(activeSample.sun_visible),
      sunNext,
      earthLabel: label(earthNext, 'earth'),
      earthDelta: delta(earthNext),
      earthIso: iso(earthNext),
      earthState: state(activeSample.earth_visible),
      earthNext,
    }
  }, [report, activeSample, lang])

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

  // Reusable "CONTEXT · Here vs. on Earth" comparison block for Educator & Kids modes
  const renderHereVsEarthTable = () => {
    if (!report) return null
    const isPolar = Math.abs(report.site.lat) > 60
    return (
      <section className="md-panel md-here-vs-earth-card">
        <div className="md-panel-header-row">
          <div>
            <span className="md-eyebrow">{lang === 'es' ? 'CONTEXTO' : 'CONTEXT'}</span>
            <h3 className="md-h2">
              {lang === 'es' ? 'Aquí vs. en la Tierra' : 'Here vs. on Earth'}
            </h3>
          </div>
          <span className="md-tag-pill">
            {lang === 'es' ? 'Referencia planetaria' : 'Planetary reference'}
          </span>
        </div>

        <div className="md-here-vs-earth-table">
          <div className="md-hve-row md-hve-head">
            <span>{lang === 'es' ? 'Parámetro' : 'Parameter'}</span>
            <span>
              🌙 {report.site.name} ({lang === 'es' ? 'Luna' : 'Moon'})
            </span>
            <span>🌍 {lang === 'es' ? 'En la Tierra' : 'On Earth'}</span>
          </div>

          <div className="md-hve-row">
            <span className="md-hve-topic">
              {lang === 'es' ? 'Duración del día' : 'Day length'}
            </span>
            <strong>
              {isPolar
                ? lang === 'es'
                  ? `Luz rasante (${report.metrics.longest_sun_window_hours} h seguidas de Sol)`
                  : `Grazing sunlight (${report.metrics.longest_sun_window_hours} h continuous Sun)`
                : lang === 'es'
                  ? '~29.5 días terrestres (14.7 días de luz + 14.7 de noche)'
                  : '~29.5 Earth days (14.7 days light + 14.7 night)'}
            </strong>
            <span className="md-caption">
              {lang === 'es'
                ? '24 horas (~12 h de día y 12 h de noche)'
                : '24 hours (~12 h day and 12 h night)'}
            </span>
          </div>

          <div className="md-hve-row">
            <span className="md-hve-topic">{lang === 'es' ? 'Atmósfera' : 'Atmosphere'}</span>
            <strong>
              {lang === 'es'
                ? 'Exosfera extremadamente tenue, casi vacío · Sin aire para respirar ni viento'
                : 'Extremely thin exosphere, almost a vacuum · No air to breathe, no wind'}
            </strong>
            <span className="md-caption">
              {lang === 'es'
                ? 'Atmósfera densa de nitrógeno y oxígeno (1 atm)'
                : 'Dense nitrogen-oxygen atmosphere (1 atm)'}
            </span>
          </div>

          <div className="md-hve-row">
            <span className="md-hve-topic">{lang === 'es' ? 'Cielo' : 'Sky'}</span>
            <strong>
              {lang === 'es'
                ? 'Negro incluso con el Sol arriba; la Tierra casi fija en el cielo'
                : 'Pitch black even at noon; Earth hangs nearly fixed in the sky'}
            </strong>
            <span className="md-caption">
              {lang === 'es'
                ? 'Azul de día por dispersión de Rayleigh'
                : 'Blue during the day due to Rayleigh scattering'}
            </span>
          </div>

          <div className="md-hve-row">
            <span className="md-hve-topic">
              {lang === 'es' ? 'Rango térmico' : 'Thermal range'}
            </span>
            <strong>
              {isPolar
                ? lang === 'es'
                  ? '-210 °C en sombras permanentes a -50 °C al Sol'
                  : '-210 °C in permanent shadow to -50 °C in sunlight'
                : lang === 'es'
                  ? '-173 °C de noche a +121 °C al mediodía lunar'
                  : '-173 °C at night to +121 °C at lunar noon'}
            </strong>
            <span className="md-caption">
              {lang === 'es' ? 'Promedio templado (~15 °C)' : 'Temperate average (~15 °C)'}
            </span>
          </div>
        </div>
      </section>
    )
  }

  return (
    <div className="md-app">
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

        <nav
          className="md-topnav"
          aria-label={lang === 'es' ? 'Navegación principal' : 'Main navigation'}
        >
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
          <div
            className="md-lang-pill"
            role="group"
            aria-label={lang === 'es' ? 'Idioma' : 'Language'}
          >
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

          {/* ? Explain / Audience Mode button */}
          <button
            type="button"
            className={explainOpen ? 'md-explain-btn active' : 'md-explain-btn'}
            onClick={() => setExplainOpen((v) => !v)}
          >
            <span>?</span> {lang === 'es' ? 'Modo' : 'Mode'}
          </button>

          {/* Account: sign in when signed out, account menu when signed in */}
          <div className="md-account">
            <button
              type="button"
              className="md-avatar-btn signed-in"
              onClick={() => setAccountMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
              aria-label={lang === 'es' ? `Cuenta de ${user.name}` : `${user.name}'s account`}
              title={user.name}
            >
              <span aria-hidden="true">{user.name.trim().charAt(0).toUpperCase() || '?'}</span>
            </button>
            {accountMenuOpen && (
              <div className="md-account-menu" role="menu">
                <p className="md-account-name">{user.name}</p>
                <p className="md-account-email">{user.email}</p>
                <button
                  type="button"
                  role="menuitem"
                  className="md-account-signout"
                  onClick={() => {
                    setAccountMenuOpen(false)
                    onSignOut()
                  }}
                >
                  {lang === 'es' ? 'Cerrar sesión' : 'Sign out'}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* =====================================================================
          EXPLAIN MODE BAR + AUDIENCE PROFILE SWITCHER
         ===================================================================== */}
      {explainOpen && (
        <div className="md-explain-banner">
          <div className="md-explain-banner-left">
            <span className="md-explain-icon">?</span>
            <strong>{lang === 'es' ? 'Modo de Vista' : 'Audience Mode'}</strong>
            <span className="md-explain-desc">
              {profileMode === 'executive' &&
                (lang === 'es'
                  ? 'Vista General: KPI consolidado, validación de enlace Tierra-Tripulación y desglose del modelo.'
                  : 'General View: Consolidated KPI, direct Earth-Crew link checks, and team model breakdown.')}
              {profileMode === 'professional' &&
                (lang === 'es'
                  ? 'Vista Especialista: efemérides topocéntricas MOON_ME (LT+S), velocidades orbitales y serie desde AWS PostgreSQL.'
                  : 'Specialist View: MOON_ME (LT+S) topocentric ephemerides, orbital velocities, and live AWS PostgreSQL series.')}
              {profileMode === 'educational' &&
                (lang === 'es'
                  ? 'Vista Educador: tarjetas didácticas de parámetros orbitales, libración lunar, clima espacial y comparación con la Tierra.'
                  : 'Educator View: didactic cards for orbital parameters, lunar libration, space weather, and Earth comparison.')}
              {profileMode === 'kids' &&
                (lang === 'es'
                  ? 'Vista Infantil: pregunta sencilla (¿Es un buen lugar para explorar?), 3 reglas visuales y simulador de cohete.'
                  : 'Kids View: friendly question (Is this a good place to explore?), 3 visual rules, and interactive rocket simulator.')}
            </span>
          </div>

          <div
            className="md-profile-pills"
            role="tablist"
            aria-label={lang === 'es' ? 'Nivel de audiencia' : 'Audience level'}
          >
            <button
              type="button"
              className={profileMode === 'professional' ? 'md-chip selected' : 'md-chip'}
              onClick={() => {
                setProfileMode('professional')
                setActiveTab('sheet')
              }}
            >
              {lang === 'es' ? 'Especialista' : 'Specialist'}
            </button>
            <button
              type="button"
              className={profileMode === 'executive' ? 'md-chip selected' : 'md-chip'}
              onClick={() => {
                setProfileMode('executive')
                setActiveTab('sheet')
              }}
            >
              {lang === 'es' ? 'General' : 'General'}
            </button>
            <button
              type="button"
              className={profileMode === 'educational' ? 'md-chip selected' : 'md-chip'}
              onClick={() => {
                setProfileMode('educational')
                setActiveTab('sheet')
              }}
            >
              {lang === 'es' ? 'Educador' : 'Educator'}
            </button>
            <button
              type="button"
              className={profileMode === 'kids' ? 'md-chip selected' : 'md-chip'}
              onClick={() => {
                setProfileMode('kids')
                setActiveTab('sheet')
              }}
            >
              {lang === 'es' ? 'Infantil' : 'Kids'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="md-error-banner">Error: {error}</p>}

      {/* =====================================================================
          SCREEN 1: CATÁLOGO ("Landing sites" — dc_catalog.pdf)
         ===================================================================== */}
      {activeTab === 'catalog' && (
        <main className="md-main">
          <header className="md-page-header">
            <div>
              <p className="md-eyebrow">
                {lang === 'es'
                  ? 'POLO SUR LUNAR · ANÁLISIS DE ESCENARIO'
                  : 'LUNAR SOUTH POLE · SCENARIO ANALYSIS'}
              </p>
              <h1 className="md-display-title">
                {lang === 'es' ? 'Sitios de alunizaje' : 'Landing sites'}
              </h1>
              <p className="md-subtitle">
                {lang === 'es'
                  ? 'Elige un sitio para evaluar el Sol y la Tierra sobre su horizonte.'
                  : 'Pick a site to see the Sun and the Earth over its horizon.'}
              </p>
            </div>
          </header>

          {/* Search & Filter Panel */}
          <section
            className="md-filter-bar-panel"
            aria-label={lang === 'es' ? 'Filtros del catálogo' : 'Catalog filters'}
          >
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
              <span className="md-label">{lang === 'es' ? 'REGIÓN' : 'REGION'}</span>
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
              <span className="md-label">{lang === 'es' ? 'VEREDICTO' : 'VERDICT'}</span>
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
                  {lang === 'es' ? 'Viable' : 'Viable'}
                </button>
                <button
                  type="button"
                  className={verdictFilter === 'marginal' ? 'md-chip selected' : 'md-chip'}
                  onClick={() => setVerdictFilter('marginal')}
                >
                  {lang === 'es' ? 'Marginal' : 'Marginal'}
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
              <h2 className="md-h2">{lang === 'es' ? 'Sitios disponibles' : 'Available sites'}</h2>
              <span className="md-caption">
                {filteredCatalogSites.length}{' '}
                {lang === 'es' ? 'ubicaciones calculadas' : 'computed locations'}
              </span>
            </div>
          </div>

          {/* 2x2 Site Cards Grid — Watermark number removed, only green check / red cross shown */}
          <section className="md-catalog-grid">
            {filteredCatalogSites.map((s) => {
              const siteRep = allSitesData[s.id]?.report
              const siteKpi = siteRep?.viability
              const score = siteKpi?.scorePct ?? (s.id === 'shackleton-blindspot' ? 18 : 86)
              const sunPct =
                siteRep?.metrics.sun_visible_pct ?? (s.id === 'shackleton-blindspot' ? 0 : 59.48)
              const earthPct =
                siteRep?.metrics.earth_visible_pct ?? (s.id === 'shackleton-blindspot' ? 0 : 73.47)
              const commGap =
                siteRep?.metrics.longest_comm_gap_hours ??
                (s.id === 'shackleton-blindspot' ? 720 : 0)
              const isBlind = siteKpi ? siteKpi.blindSpotDetected : s.id === 'shackleton-blindspot'
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
                      <p className="md-caption">{translateRegion(s.region, lang)}</p>
                    </div>
                    <div className="md-site-card-watermark">
                      <span className={`md-verdict-inline ${isBlind ? 'not-viable' : 'viable'}`}>
                        {isBlind ? (lang === 'es' ? '× No viable' : '× Not viable') : '✓ Viable'}
                      </span>
                    </div>
                  </div>

                  <div className="md-site-coords">
                    {latFormatted}, {lonFormatted}
                  </div>
                  <div className="md-caption">
                    {lang === 'es' ? 'Fuente:' : 'Source:'} {s.source}
                  </div>

                  {isBlind ? (
                    <div className="md-blind-spot-inline">
                      <span className="md-blind-pill">
                        {lang === 'es' ? '× Punto ciego' : '× Blind spot'}
                      </span>
                      <p className="md-site-verdict-line">
                        {lang === 'es'
                          ? 'No se puede aterrizar (Pérdida crítica de línea de visión).'
                          : "It can't be done (Critical line-of-sight loss)."}
                      </p>
                    </div>
                  ) : (
                    <p className="md-site-verdict-line">
                      {lang === 'es'
                        ? 'Sí, es viable dentro de la ventana operativa.'
                        : 'Yes, it can be done within the operational window.'}
                    </p>
                  )}

                  <div className="md-site-metrics-row">
                    <div>
                      <span className="md-metric-mini-label">
                        {lang === 'es' ? 'Puntuación' : 'Model score'}
                      </span>
                      <strong className="md-metric-mini-val">{score}</strong>
                    </div>
                    <div>
                      <span className="md-metric-mini-label">
                        {lang === 'es' ? 'Sol visible' : 'Sun visible'}
                      </span>
                      <strong className="md-metric-mini-val">{sunPct.toFixed(2)}%</strong>
                    </div>
                    <div>
                      <span className="md-metric-mini-label">
                        {lang === 'es' ? 'Tierra visible' : 'Earth visible'}
                      </span>
                      <strong className="md-metric-mini-val">{earthPct.toFixed(2)}%</strong>
                    </div>
                    <div>
                      <span className="md-metric-mini-label">
                        {lang === 'es' ? 'Corte comm' : 'Comm gap'}
                      </span>
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

          {/* CUSTOM SCENARIO · Custom coordinates panel */}
          <section className="md-custom-coords-panel">
            <div className="md-custom-coords-info">
              <span className="md-eyebrow">
                {lang === 'es' ? 'ESCENARIO PERSONALIZADO' : 'CUSTOM SCENARIO'}
              </span>
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
                <label htmlFor="custom-lat">{lang === 'es' ? 'Latitud' : 'Latitude'}</label>
                <input
                  id="custom-lat"
                  type="text"
                  value={customLat}
                  onChange={(e) => setCustomLat(e.target.value)}
                  className={latInvalid ? 'md-text-input invalid' : 'md-text-input'}
                />
                <span className="md-caption">
                  {lang === 'es' ? 'Latitud -90 a 90' : 'Latitude -90 to 90'}
                </span>
                {latInvalid && (
                  <span className="md-input-error">
                    {lang === 'es'
                      ? 'La latitud debe estar entre -90 y 90'
                      : 'Latitude must be between -90 and 90'}
                  </span>
                )}
              </div>

              <div className="md-input-field">
                <label htmlFor="custom-lon">{lang === 'es' ? 'Longitud' : 'Longitude'}</label>
                <input
                  id="custom-lon"
                  type="text"
                  value={customLon}
                  onChange={(e) => setCustomLon(e.target.value)}
                  className={lonInvalid ? 'md-text-input invalid' : 'md-text-input'}
                />
                <span className="md-caption">
                  {lang === 'es' ? 'Longitud -180 a 180' : 'Longitude -180 to 180'}
                </span>
                {lonInvalid && (
                  <span className="md-input-error">
                    {lang === 'es'
                      ? 'La longitud debe estar entre -180 y 180'
                      : 'Longitude must be between -180 and 180'}
                  </span>
                )}
              </div>

              <div className="md-custom-coords-cta">
                <button
                  type="button"
                  className="md-btn primary"
                  disabled={latInvalid || lonInvalid || computingCustom}
                  aria-busy={computingCustom}
                  onClick={handleComputeCustomSite}
                >
                  {computingCustom
                    ? lang === 'es'
                      ? 'Calculando…'
                      : 'Computing…'
                    : `+ ${lang === 'es' ? 'Calcular sitio' : 'Compute site'}`}
                </button>
              </div>
            </div>
          </section>

          {/* Floating Compare Dock Bar */}
          {compareIds.length > 0 && (
            <div className="md-compare-dock">
              <div className="md-compare-dock-left">
                <strong>
                  {lang === 'es' ? 'Comparar' : 'Compare'}{' '}
                  <span className="md-muted">
                    ({compareIds.length} {lang === 'es' ? 'de 3' : 'of 3'})
                  </span>
                </strong>
                <div className="md-compare-dock-chips">
                  {compareIds.map((cid) => {
                    const sMeta = sites.find((s) => s.id === cid)
                    if (!sMeta) return null
                    return (
                      <span key={cid} className="md-dock-chip">
                        {sMeta.name}
                        <button
                          type="button"
                          onClick={() => toggleCompareSite(cid)}
                          aria-label={
                            lang === 'es' ? `Quitar ${sMeta.name}` : `Remove ${sMeta.name}`
                          }
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
          SCREEN 2: FICHA DE SITIO — 4 DIFFERENTIATED AUDIENCE VIEWS
          (Specialist / General / Educator / Kids — matching Diseños completos.pdf)
         ===================================================================== */}
      {activeTab === 'sheet' && report && kpi && activeSample && (
        <main className="md-main">
          {/* Site switcher pills at top of sheet */}
          <div className="md-sheet-site-switcher">
            {sites.map((s) => (
              <button
                key={s.id}
                type="button"
                className={s.id === siteId ? 'md-chip selected' : 'md-chip'}
                onClick={() => setSiteId(s.id)}
              >
                {s.name}
              </button>
            ))}
            {customReport && (
              <button
                type="button"
                className={siteId === CUSTOM_SITE_ID ? 'md-chip selected' : 'md-chip'}
                onClick={() => setSiteId(CUSTOM_SITE_ID)}
              >
                {customReport.site.name}
              </button>
            )}
          </div>

          <header className="md-page-header">
            <div>
              <p className="md-eyebrow">
                {lang === 'es'
                  ? 'POLO SUR LUNAR · ANÁLISIS DE ESCENARIO'
                  : 'LUNAR SOUTH POLE · SCENARIO ANALYSIS'}
              </p>
              <h1 className="md-display-title">{report.site.name}</h1>
              <p className="md-subtitle">
                {translateRegion(report.site.region, lang)} · {report.site.lat.toFixed(4)}°,{' '}
                {report.site.lon.toFixed(4)}° · {lang === 'es' ? 'Fuente:' : 'Source:'}{' '}
                {report.site.source}
              </p>
            </div>

            {/* Audience Mode Selector right in the Sheet Header (Matches Diseños completos.pdf) */}
            <div className="md-page-header-right md-sheet-header-controls">
              <div
                className="md-sheet-mode-pills"
                role="tablist"
                aria-label={lang === 'es' ? 'Modo de audiencia' : 'Audience mode'}
              >
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
                  {lang === 'es' ? 'General' : 'General'}
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
                  {lang === 'es' ? 'Infantil' : 'Kids'}
                </button>
              </div>
            </div>
          </header>

          {/* =================================================================
              VIEW A: ESPECIALISTA (profileMode === 'professional')
              Matches Screen 1 of Diseños completos.pdf (dc_sheet1_spec.pdf)
             ================================================================= */}
          {profileMode === 'professional' && (
            <>
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
                  <span className="md-caption">
                    {lang === 'es' ? 'Puntuación del modelo' : 'Model score'}
                  </span>
                  <div className="md-score-big">
                    {kpi.scorePct} <span>/100</span>
                  </div>
                  <div className="md-caption">
                    {kpi.verdict === 'GO'
                      ? lang === 'es'
                        ? 'Viable'
                        : 'Viable'
                      : kpi.verdict === 'CAUTION'
                        ? lang === 'es'
                          ? 'Marginal / Condicional'
                          : 'Marginal / Conditional'
                        : lang === 'es'
                          ? 'No viable (Punto ciego)'
                          : 'Not viable (Blind spot)'}
                  </div>
                  <div className="md-status-indicator">
                    <span className="md-sq-indicator" /> {kpi.verdict}
                  </div>
                </div>

                <div className="md-panel md-breakdown-card">
                  <div className="md-panel-header-row">
                    <span className="md-caption">
                      {lang === 'es' ? 'Desglose de puntuación' : 'Score breakdown'}
                    </span>
                    <span className="md-caption">
                      {lang === 'es' ? 'Modelo ORYSEL' : 'Model Score'}
                    </span>
                  </div>
                  <div className="md-breakdown-bars">
                    <div className="md-breakdown-row">
                      <span>{lang === 'es' ? 'Iluminación Solar' : 'Solar Illumination'}</span>
                      <div className="md-mini-track">
                        <div
                          className="md-mini-fill sun"
                          style={{ width: `${kpi.subscores.illumination}%` }}
                        />
                      </div>
                      <strong>{kpi.subscores.illumination}%</strong>
                    </div>
                    <div className="md-breakdown-row">
                      <span>
                        {lang === 'es' ? 'Enlace Directo Tierra (DTE)' : 'Direct Earth Link (DTE)'}
                      </span>
                      <div className="md-mini-track">
                        <div
                          className="md-mini-fill earth"
                          style={{ width: `${kpi.subscores.communication}%` }}
                        />
                      </div>
                      <strong>{kpi.subscores.communication}%</strong>
                    </div>
                    <div className="md-breakdown-row">
                      <span>
                        {lang === 'es' ? 'Despeje Acimutal Terreno' : 'Azimuthal Terrain Clearance'}
                      </span>
                      <div className="md-mini-track">
                        <div
                          className="md-mini-fill viable"
                          style={{ width: `${kpi.subscores.azimuthTopography}%` }}
                        />
                      </div>
                      <strong>{kpi.subscores.azimuthTopography}%</strong>
                    </div>
                    <div className="md-breakdown-row">
                      <span>
                        {lang === 'es'
                          ? 'Estabilidad Exosfera / Regolito'
                          : 'Exosphere / Regolith Stability'}
                      </span>
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
                        <h2 className="md-h1">
                          {lang === 'es'
                            ? 'Elevación del Sol y la Tierra'
                            : 'Sun and Earth Elevation'}
                        </h2>
                        <p className="md-caption">
                          {report.site.name} ·{' '}
                          {lang === 'es' ? '14 nov — 14 dic 2026' : 'Nov 14 — Dec 14, 2026'}
                        </p>
                      </div>
                      <span className="md-caption">
                        {lang === 'es' ? 'Marco MOON_ME (LT+S)' : 'MOON_ME Frame (LT+S)'}
                      </span>
                    </div>

                    {/* Epoch readout strip */}
                    <div className="md-mc-readout-strip">
                      <div className="md-mc-epoch-box">
                        <strong>{activeSample.t.slice(0, 16).replace('T', ' ')} UTC</strong>
                        <span>
                          {lang === 'es' ? 'Época de referencia UTC' : 'Reference epoch UTC'}
                        </span>
                      </div>
                      <div className="md-mc-body-readout">
                        <span className="md-sun-text">
                          {lang === 'es' ? 'Sol' : 'Sun'}{' '}
                          <strong>{activeSample.sun_el.toFixed(2)}°</strong>
                        </span>
                        <span className="md-caption">
                          {lang === 'es' ? 'Azimut' : 'Azimuth'} {activeSample.sun_az.toFixed(1)}°
                        </span>
                      </div>
                      <div className="md-mc-body-readout">
                        <span className="md-earth-text">
                          {lang === 'es' ? 'Tierra' : 'Earth'}{' '}
                          <strong>{activeSample.earth_el.toFixed(2)}°</strong>
                        </span>
                        <span className="md-caption">
                          {lang === 'es' ? 'Azimut' : 'Azimuth'} {activeSample.earth_az.toFixed(1)}°
                        </span>
                      </div>
                    </div>

                    <ElevationChart
                      report={report}
                      selectedIndex={selectedSampleIdx}
                      onSelectIndex={(idx) => setSelectedSampleIdx(idx)}
                      lang={lang}
                    />

                    <div className="md-mc-chart-footer">
                      <div className="md-orbital-legend">
                        <span>
                          <i className="md-dot sun" /> {lang === 'es' ? 'Sol' : 'Sun'}
                        </span>
                        <span>
                          <i className="md-dot earth" /> {lang === 'es' ? 'Tierra' : 'Earth'}
                        </span>
                        <span>
                          <i className="md-line-swatch dashed" />{' '}
                          {lang === 'es' ? 'Umbral de enlace ·' : 'Link threshold ·'}{' '}
                          {Math.max(2, report.site.minCommElevationDeg ?? 2)}°
                        </span>
                      </div>
                      <div className="md-caption">
                        {lang === 'es'
                          ? 'Elevación topocéntrica · grados (°) · Radio lunar: 1737.4 km'
                          : 'Topocentric elevation · degrees (°) · Lunar radius: 1737.4 km'}
                      </div>
                    </div>
                  </div>

                  {/* Right: 24-hour outlook + 09 / TIME SLIDER */}
                  <div className="md-mc-outlook-col">
                    <TwentyFourHourOutlook
                      report={report}
                      selectedIndex={selectedSampleIdx}
                      lang={lang}
                    />

                    {/* 09 / TIME SLIDER · PAUSED / PLAYING */}
                    <div className="md-time-slider-card">
                      <div className="md-time-slider-top">
                        <button
                          type="button"
                          className="md-play-btn"
                          onClick={() => setIsPlaying((p) => !p)}
                        >
                          {isPlaying
                            ? lang === 'es'
                              ? 'Ⅱ Pausa'
                              : 'Ⅱ Pause'
                            : lang === 'es'
                              ? '▶ Reproducir'
                              : '▶ Play'}
                        </button>
                        <div className="md-scenario-time-label">
                          <span>{lang === 'es' ? 'TIEMPO DE ESCENARIO' : 'SCENARIO TIME'}</span>
                          <strong>{activeSample.t.slice(0, 16).replace('T', ' ')} UTC</strong>
                        </div>
                        <span className="md-caption">1×</span>
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
                        <span>{lang === 'es' ? '14 Dic 00:00 UTC' : '14 Dec 00:00 UTC'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Row 4: 8 Metric Tiles in 4x2 Grid */}
              <section className="md-eight-metrics-grid">
                <div className="md-metric-tile">
                  <span className="md-label">{lang === 'es' ? 'SOL VISIBLE' : 'SUN VISIBLE'}</span>
                  <strong className="md-tile-number sun">{report.metrics.sun_visible_pct}%</strong>
                  <span className="md-caption">
                    {lang === 'es' ? 'Valor calculado' : 'Computed value'}
                  </span>
                  <span className="md-caption">
                    {lang === 'es' ? 'Fuente: SPICE DE440' : 'Source: SPICE DE440'}
                  </span>
                </div>
                <div className="md-metric-tile">
                  <span className="md-label">
                    {lang === 'es' ? 'TIERRA VISIBLE' : 'EARTH VISIBLE'}
                  </span>
                  <strong className="md-tile-number earth">
                    {report.metrics.earth_visible_pct}%
                  </strong>
                  <span className="md-caption">
                    {lang === 'es' ? 'Valor calculado' : 'Computed value'}
                  </span>
                  <span className="md-caption">
                    {lang === 'es' ? 'Fuente: SPICE DE440' : 'Source: SPICE DE440'}
                  </span>
                </div>
                <div className="md-metric-tile">
                  <span className="md-label">
                    {lang === 'es' ? 'AMBOS VISIBLES' : 'BOTH VISIBLE'}
                  </span>
                  <strong className="md-tile-number">{report.metrics.both_visible_pct}%</strong>
                  <span className="md-caption">
                    {lang === 'es' ? 'Valor calculado' : 'Computed value'}
                  </span>
                  <span className="md-caption">
                    {lang === 'es' ? 'Fuente: SPICE DE440' : 'Source: SPICE DE440'}
                  </span>
                </div>
                <div className="md-metric-tile">
                  <span className="md-label">
                    {lang === 'es' ? 'VENTANA SOLAR MÁX.' : 'LONGEST SUN WINDOW'}
                  </span>
                  <strong className="md-tile-number">
                    {report.metrics.longest_sun_window_hours} h
                  </strong>
                  <span className="md-caption">
                    {lang === 'es' ? 'Valor calculado' : 'Computed value'}
                  </span>
                  <span className="md-caption">
                    {lang === 'es' ? 'Fuente: Muestras horarias' : 'Source: Hourly samples'}
                  </span>
                </div>

                <div className="md-metric-tile">
                  <span className="md-label">
                    {lang === 'es' ? 'NOCHE MÁS LARGA' : 'LONGEST NIGHT'}
                  </span>
                  <strong className="md-tile-number">{report.metrics.longest_night_hours} h</strong>
                  <span className="md-caption">
                    {lang === 'es' ? 'Valor calculado' : 'Computed value'}
                  </span>
                  <span className="md-caption">
                    {lang === 'es' ? 'Fuente: Muestras horarias' : 'Source: Hourly samples'}
                  </span>
                </div>
                <div className="md-metric-tile">
                  <span className="md-label">
                    {lang === 'es' ? 'CORTE COMM MÁX.' : 'LONGEST COMM GAP'}
                  </span>
                  <strong className="md-tile-number">
                    {report.metrics.longest_comm_gap_hours} h
                  </strong>
                  <span className="md-caption">
                    {lang === 'es' ? 'Valor calculado' : 'Computed value'}
                  </span>
                  <span className="md-caption">
                    {lang === 'es' ? 'Fuente: Muestras horarias' : 'Source: Hourly samples'}
                  </span>
                </div>
                <div className="md-metric-tile">
                  <span className="md-label">
                    {lang === 'es' ? 'ELEVACIÓN SOLAR MÁX.' : 'MAX SUN ELEVATION'}
                  </span>
                  <strong className="md-tile-number sun">{report.metrics.max_sun_el}°</strong>
                  <span className="md-caption">
                    {lang === 'es' ? 'Valor calculado' : 'Computed value'}
                  </span>
                  <span className="md-caption">
                    {lang === 'es' ? 'Fuente: SPICE DE440' : 'Source: SPICE DE440'}
                  </span>
                </div>
                <div className="md-metric-tile">
                  <span className="md-label">
                    {lang === 'es' ? 'ELEVACIÓN TIERRA MÁX.' : 'MAX EARTH ELEVATION'}
                  </span>
                  <strong className="md-tile-number earth">{report.metrics.max_earth_el}°</strong>
                  <span className="md-caption">
                    {lang === 'es' ? 'Valor calculado' : 'Computed value'}
                  </span>
                  <span className="md-caption">
                    {lang === 'es' ? 'Fuente: SPICE DE440' : 'Source: SPICE DE440'}
                  </span>
                </div>
              </section>

              {/* Row 5: MODEL INPUTS · Environment & approach */}
              <section className="md-panel md-env-panel">
                <div className="md-panel-header-row">
                  <div>
                    <span className="md-eyebrow">
                      {lang === 'es' ? 'PARÁMETROS DEL MODELO' : 'MODEL INPUTS'}
                    </span>
                    <h3 className="md-h2">
                      {lang === 'es' ? 'Ambiente y velocidades' : 'Environment and velocities'}
                    </h3>
                    <p className="md-caption">
                      {lang === 'es'
                        ? 'Polvo, campo magnético y exosfera son supuestos del equipo para el modelo, no mediciones. Las velocidades sí se calculan con la gravedad lunar (√(GM/r)).'
                        : 'Dust, magnetic field and exosphere are team assumptions for the model, not measurements. The velocities are computed from lunar gravity (√(GM/r)).'}
                    </p>
                  </div>
                  <span className="md-tag-pill">
                    {lang === 'es' ? 'Supuesto del modelo' : 'Model assumption'}
                  </span>
                </div>

                <div className="md-env-grid">
                  <div className="md-env-cell">
                    <span className="md-caption">
                      {lang === 'es' ? 'Riesgo de polvo electrostático' : 'Electrostatic dust risk'}
                    </span>
                    <strong className="md-env-val marginal">
                      △ {dustRiskLabel(report.site.electrostaticDustRisk, lang)}
                    </strong>
                  </div>
                  <div className="md-env-cell">
                    <span className="md-caption">
                      {lang === 'es' ? 'Anomalía magnética' : 'Magnetic anomaly'}
                    </span>
                    <strong className="md-env-val">
                      {report.site.magneticAnomalynT ?? '—'} nT{' '}
                      <small>({lang === 'es' ? 'supuesto' : 'assumed'})</small>
                    </strong>
                  </div>
                  <div className="md-env-cell">
                    <span className="md-caption">
                      {lang === 'es'
                        ? 'Exposición a la exosfera (escala 0–1)'
                        : 'Exosphere exposure (0–1 scale)'}
                    </span>
                    <strong className="md-env-val">
                      {report.site.exosphereInteractionIndex ?? 0.25}
                    </strong>
                  </div>
                  <div className="md-env-cell">
                    <span className="md-caption">
                      {lang === 'es'
                        ? 'Velocidad orbital en superficie'
                        : 'Orbital velocity at the surface'}
                    </span>
                    <strong className="md-env-val">{kpi.kinematics.orbitalVelocityKmS} km/s</strong>
                  </div>
                  <div className="md-env-cell">
                    <span className="md-caption">
                      {lang === 'es' ? 'Velocidad de escape' : 'Escape velocity'}
                    </span>
                    <strong className="md-env-val">{kpi.kinematics.escapeVelocityKmS} km/s</strong>
                  </div>
                </div>
              </section>

              {/* Row 6: Live AWS PostgreSQL NASA JPL Horizons Table */}
              <section className="md-panel md-aws-table-panel">
                <div className="md-aws-table-header">
                  <div className="md-aws-tabs">
                    <button
                      type="button"
                      className={sheetBottomTab === 'aws' ? 'md-tab-btn active' : 'md-tab-btn'}
                      onClick={() => setSheetBottomTab('aws')}
                    >
                      {lang === 'es'
                        ? `Serie NASA JPL Horizons desde AWS (/api/horizons/${siteId})`
                        : `NASA JPL Horizons Series from AWS (/api/horizons/${siteId})`}
                    </button>
                    <button
                      type="button"
                      className={sheetBottomTab === 'events' ? 'md-tab-btn active' : 'md-tab-btn'}
                      onClick={() => setSheetBottomTab('events')}
                    >
                      {lang === 'es'
                        ? `Eventos de Salida y Ocultación (${report.events.length})`
                        : `Rise & Set Horizon Events (${report.events.length})`}
                    </button>
                  </div>
                  <span className="md-mono-caption">
                    {lang === 'es' ? 'Origen:' : 'Source:'}{' '}
                    {awsRowsSource === 'aws-live'
                      ? `AWS EC2 PostgreSQL (${AWS_BASE_URL})`
                      : lang === 'es'
                        ? 'Respaldo Local Sincronizado (SPICE DE440)'
                        : 'Synchronized Local Fallback (SPICE DE440)'}
                  </span>
                </div>

                {sheetBottomTab === 'aws' && (
                  <div className="md-table-scroll">
                    <table className="md-data-table">
                      <thead>
                        <tr>
                          <th>{lang === 'es' ? 'Sitio' : 'Site'}</th>
                          <th>{lang === 'es' ? "Época UTC ('t')" : "UTC Epoch ('t')"}</th>
                          <th>{lang === 'es' ? 'Cuerpo' : 'Body'}</th>
                          <th>{lang === 'es' ? "Acimut ('az_deg')" : "Azimuth ('az_deg')"}</th>
                          <th>{lang === 'es' ? "Elevación ('el_deg')" : "Elevation ('el_deg')"}</th>
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
                                {row.cuerpo === 'sol'
                                  ? lang === 'es'
                                    ? 'Sol'
                                    : 'Sun'
                                  : lang === 'es'
                                    ? 'Tierra'
                                    : 'Earth'}
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
                          <th>{lang === 'es' ? 'Cuerpo' : 'Body'}</th>
                          <th>{lang === 'es' ? 'Evento' : 'Event'}</th>
                          <th>{lang === 'es' ? 'Fecha y Hora (UTC)' : 'Date & Time (UTC)'}</th>
                          <th>{lang === 'es' ? 'Acimut' : 'Azimuth'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.events.map((ev) => (
                          <tr key={`${ev.body}-${ev.type}-${ev.t}`}>
                            <td>
                              {ev.body === 'sun'
                                ? lang === 'es'
                                  ? '☀️ Sol'
                                  : '☀️ Sun'
                                : lang === 'es'
                                  ? '🌍 Tierra'
                                  : '🌍 Earth'}
                            </td>
                            <td>
                              {ev.type === 'rise'
                                ? lang === 'es'
                                  ? 'Salida (+0°)'
                                  : 'Rise (+0°)'
                                : lang === 'es'
                                  ? 'Puesta (-0°)'
                                  : 'Set (-0°)'}
                            </td>
                            <td className="mono">{ev.t.slice(0, 19).replace('T', ' ')}Z</td>
                            <td className="mono">{ev.az.toFixed(1)}°</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Local Horizon 360° & Sky Visibility Polar Radar */}
              <LocalHorizonAndSkyRow report={report} sample={activeSample} lang={lang} />
            </>
          )}

          {/* =================================================================
              VIEW B: GENERAL (profileMode === 'executive')
              Matches Screen 2 of Diseños completos.pdf (dc_sheet2_edu.pdf)
             ================================================================= */}
          {profileMode === 'executive' && (
            <>
              {/* Row 1: Site Summary Panel + Glowing Consolidated Viability KPI Card */}
              <section className="md-exec-hero-grid">
                <div className="md-panel md-exec-site-summary">
                  <span className="md-eyebrow">
                    {lang === 'es' ? 'FICHA EJECUTIVA DEL SITIO' : 'EXECUTIVE SITE BRIEF'}
                  </span>
                  <h2 className="md-display-title">{report.site.name}</h2>
                  <p className="md-caption">{translateRegion(report.site.region, lang)}</p>
                  <p className="md-exec-desc">{translateSiteDescription(report.site, lang)}</p>
                  <div className="md-exec-meta-row">
                    <span className="md-tag-pill">
                      Lat {report.site.lat.toFixed(2)}° · Lon {report.site.lon.toFixed(2)}° · Alt{' '}
                      {report.site.heightKm} km
                    </span>
                    <span className="md-tag-pill">{report.site.source}</span>
                  </div>
                </div>

                <div
                  className={`md-panel md-exec-kpi-card ${
                    kpi.verdict === 'GO'
                      ? 'viable'
                      : kpi.verdict === 'CAUTION'
                        ? 'marginal'
                        : 'no-go'
                  }`}
                >
                  <span className="md-eyebrow">
                    {lang === 'es' ? 'KPI DE VIABILIDAD CONSOLIDADO' : 'CONSOLIDATED VIABILITY KPI'}
                  </span>
                  <div className="md-exec-kpi-score-row">
                    <strong className="md-exec-kpi-big">{kpi.scorePct}%</strong>
                    <span className="md-exec-kpi-verdict">{kpi.verdict}</span>
                  </div>
                  <p className="md-caption">
                    {lang === 'es'
                      ? 'Evaluación integral de iluminación solar, comunicación y terreno'
                      : 'Comprehensive evaluation of solar light, communication, and terrain'}
                  </p>
                </div>
              </section>

              {/* Row 2: 2 Check Cards on Left + 2x2 Subscore Grid on Right (Matches dc_sheet2_edu.pdf) */}
              <section className="md-exec-checks-grid">
                <div className="md-exec-checks-left">
                  <div className={`md-panel md-exec-check-card ${kpi.commLinkOk ? 'ok' : 'veto'}`}>
                    <strong className="md-exec-check-title">
                      {kpi.commLinkOk ? '✓' : '×'}{' '}
                      {lang === 'es'
                        ? 'Enlace Directo Tierra-Tripulación'
                        : 'Direct Earth-Crew Link'}
                    </strong>
                    <p className="md-caption">
                      {kpi.commLinkOk
                        ? lang === 'es'
                          ? `Línea de visión (LoS) activa ${report.metrics.earth_visible_pct}% del mes sobre el horizonte topográfico.`
                          : `Line of sight (LoS) active ${report.metrics.earth_visible_pct}% of the month above the local horizon.`
                        : lang === 'es'
                          ? 'VETO: La muralla del cráter bloquea la señal de radio con la Tierra.'
                          : 'VETO: The crater wall blocks the direct radio signal with Earth.'}
                    </p>
                  </div>

                  <div
                    className={`md-panel md-exec-check-card ${kpi.orbiterPhotoLoS ? 'ok' : 'veto'}`}
                  >
                    <strong className="md-exec-check-title">
                      {kpi.orbiterPhotoLoS ? '✓' : '×'}{' '}
                      {lang === 'es'
                        ? 'Visibilidad del satélite (supuesto del modelo)'
                        : 'Satellite visibility (model assumption)'}
                    </strong>
                    <p className="md-caption">
                      {kpi.orbiterPhotoLoS
                        ? lang === 'es'
                          ? `El modelo supone un paso del satélite a ${report.site.orbiterPassElDeg ?? '—'}° de elevación, por encima del horizonte del sitio.`
                          : `The model assumes a satellite pass at ${report.site.orbiterPassElDeg ?? '—'}° elevation, above the site's horizon.`
                        : lang === 'es'
                          ? `Veto: el paso supuesto del satélite (${report.site.orbiterPassElDeg ?? '—'}°) queda tapado por el horizonte del sitio.`
                          : `Veto: the assumed satellite pass (${report.site.orbiterPassElDeg ?? '—'}°) is hidden by the site's horizon.`}
                    </p>
                  </div>
                </div>

                <div className="md-exec-subscores-2x2">
                  <div className="md-panel md-exec-subscore-box">
                    <div className="md-exec-subscore-head">
                      <span>{lang === 'es' ? 'Iluminación Solar' : 'Solar Illumination'}</span>
                      <strong>{kpi.subscores.illumination}/100</strong>
                    </div>
                    <div className="md-mini-track">
                      <div
                        className="md-mini-fill sun"
                        style={{ width: `${kpi.subscores.illumination}%` }}
                      />
                    </div>
                    <span className="md-caption">
                      {lang === 'es'
                        ? `Sol visible ${report.metrics.sun_visible_pct}% · Ventana máx ${report.metrics.longest_sun_window_hours} h`
                        : `Sun visible ${report.metrics.sun_visible_pct}% · Max window ${report.metrics.longest_sun_window_hours} h`}
                    </span>
                  </div>

                  <div className="md-panel md-exec-subscore-box">
                    <div className="md-exec-subscore-head">
                      <span>{lang === 'es' ? 'Enlace y Telemetría' : 'Link & Telemetry'}</span>
                      <strong>{kpi.subscores.communication}/100</strong>
                    </div>
                    <div className="md-mini-track">
                      <div
                        className="md-mini-fill earth"
                        style={{ width: `${kpi.subscores.communication}%` }}
                      />
                    </div>
                    <span className="md-caption">
                      {lang === 'es'
                        ? `Tierra visible ${report.metrics.earth_visible_pct}% · Corte máx ${report.metrics.longest_comm_gap_hours} h`
                        : `Earth visible ${report.metrics.earth_visible_pct}% · Max gap ${report.metrics.longest_comm_gap_hours} h`}
                    </span>
                  </div>

                  <div className="md-panel md-exec-subscore-box">
                    <div className="md-exec-subscore-head">
                      <span>{lang === 'es' ? 'Acimut / Topografía' : 'Azimuth / Topography'}</span>
                      <strong>{kpi.subscores.azimuthTopography}/100</strong>
                    </div>
                    <div className="md-mini-track">
                      <div
                        className="md-mini-fill viable"
                        style={{ width: `${kpi.subscores.azimuthTopography}%` }}
                      />
                    </div>
                    <span className="md-caption">
                      {report.site.horizonSource === 'supuesto'
                        ? lang === 'es'
                          ? 'Horizonte supuesto (no medido) · Sol máx. ' +
                            report.metrics.max_sun_el.toFixed(1) +
                            '°'
                          : 'Assumed horizon (not measured) · Max Sun ' +
                            report.metrics.max_sun_el.toFixed(1) +
                            '°'
                        : lang === 'es'
                          ? 'Horizonte liso (sin relieve) · Sol máx. ' +
                            report.metrics.max_sun_el.toFixed(1) +
                            '°'
                          : 'Smooth horizon (no terrain) · Max Sun ' +
                            report.metrics.max_sun_el.toFixed(1) +
                            '°'}
                    </span>
                  </div>

                  <div className="md-panel md-exec-subscore-box">
                    <div className="md-exec-subscore-head">
                      <span>{lang === 'es' ? 'Ambiente Lunar' : 'Lunar Environment'}</span>
                      <strong>{kpi.subscores.environment}/100</strong>
                    </div>
                    <div className="md-mini-track">
                      <div
                        className="md-mini-fill sun"
                        style={{ width: `${kpi.subscores.environment}%` }}
                      />
                    </div>
                    <span className="md-caption">
                      {lang === 'es'
                        ? `Supuesto del modelo · polvo ${dustRiskLabel(report.site.electrostaticDustRisk, lang).toLowerCase()}`
                        : `Model assumption · ${dustRiskLabel(report.site.electrostaticDustRisk, lang).toLowerCase()} dust`}
                    </span>
                  </div>
                </div>
              </section>

              {/* Row 3: Unified Dark Container (Sunrise/Earthrise + TEAM MODEL VERDICT + 4-column breakdown) */}
              <section className="md-team-verdict-container">
                <div className="md-two-col-grid">
                  {(['sun', 'earth'] as const).map((body) => {
                    const visible =
                      body === 'sun' ? activeSample.sun_visible : activeSample.earth_visible
                    const el = body === 'sun' ? activeSample.sun_el : activeSample.earth_el
                    const nextEv = body === 'sun' ? nextCrossings.sunNext : nextCrossings.earthNext
                    const d = body === 'sun' ? nextCrossings.sunDelta : nextCrossings.earthDelta
                    const when = body === 'sun' ? nextCrossings.sunIso : nextCrossings.earthIso
                    const es = lang === 'es'
                    return (
                      <div key={body} className="md-panel md-countdown-card">
                        <span className="md-caption">
                          {body === 'sun' ? '☀️ ' : '🌍 '}
                          {body === 'sun' ? (es ? 'Sol' : 'Sun') : es ? 'Tierra' : 'Earth'}
                        </span>
                        <div className="md-countdown-value">
                          {visible
                            ? es
                              ? 'Sobre el horizonte'
                              : 'Above the horizon'
                            : nextEv
                              ? `${es ? 'Sale en' : 'Rises in'} ${d}`
                              : es
                                ? 'No sale en esta ventana'
                                : 'Does not rise in this window'}
                        </div>
                        <div className="md-caption">
                          {es ? 'Elevación' : 'Elevation'} {el > 0 ? '+' : ''}
                          {el.toFixed(1)}° ·{' '}
                          {visible
                            ? nextEv
                              ? `${es ? 'se oculta en' : 'sets in'} ${d}`
                              : es
                                ? 'no se oculta en esta ventana'
                                : 'does not set in this window'
                            : when}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="md-panel md-team-model-verdict-box">
                  <div className="md-panel-header-row">
                    <div>
                      <span className="md-eyebrow">
                        {lang === 'es' ? 'VEREDICTO DEL MODELO' : 'TEAM MODEL VERDICT'}
                      </span>
                      <div className="md-team-score-inline">
                        <strong>{kpi.scorePct}</strong>
                        <span>{lang === 'es' ? 'Puntuación / 100' : 'Model score / 100'}</span>
                      </div>
                    </div>
                    <span className="md-tag-pill">
                      {lang === 'es' ? 'Estimación del modelo' : 'Team model estimate'}
                    </span>
                  </div>

                  <p className="md-caption">
                    {kpi.blindSpotDetected
                      ? lang === 'es'
                        ? 'Sitio descartado por pérdida crítica de línea de visión directa con la Tierra y el orbitador.'
                        : 'Site ruled out due to critical loss of direct line-of-sight with Earth and the orbiter.'
                      : lang === 'es'
                        ? 'Viable dentro de la ventana analizada: energía solar continua y enlace directo Tierra-Tripulación confirmado.'
                        : 'Viable within the analyzed window: continuous solar power and direct Earth-Crew link confirmed.'}
                  </p>

                  <div className="md-team-pills-row">
                    <span className={`md-team-check-pill ${kpi.commLinkOk ? 'ok' : 'no'}`}>
                      {kpi.commLinkOk ? '✓' : '×'}{' '}
                      {lang === 'es'
                        ? 'Enlace directo Tierra-Tripulación'
                        : 'Direct Earth-crew link'}
                    </span>
                    <span className={`md-team-check-pill ${kpi.orbiterPhotoLoS ? 'ok' : 'no'}`}>
                      {kpi.orbiterPhotoLoS ? '✓' : '×'}{' '}
                      {lang === 'es'
                        ? 'Satélite visible (supuesto)'
                        : 'Satellite visible (assumed)'}
                    </span>
                  </div>
                </div>

                <div className="md-panel md-team-breakdown-4col">
                  <div className="md-panel-header-row">
                    <div>
                      <span className="md-eyebrow">
                        {lang === 'es' ? 'MODELO DEL EQUIPO' : 'TEAM MODEL'}
                      </span>
                      <h3 className="md-h2">
                        {lang === 'es'
                          ? 'Desglose de puntuación del modelo'
                          : 'Model score breakdown'}
                      </h3>
                    </div>
                    <span className="md-tag-pill">
                      {lang === 'es' ? 'Estimación del modelo' : 'Team model estimate'}
                    </span>
                  </div>

                  <div className="md-four-bars-row">
                    <div className="md-col-bar-item">
                      <div className="md-col-bar-top">
                        <span>{lang === 'es' ? 'Iluminación' : 'Illumination'}</span>
                        <strong>{kpi.subscores.illumination}/100</strong>
                      </div>
                      <div className="md-mini-track">
                        <div
                          className="md-mini-fill viable"
                          style={{ width: `${kpi.subscores.illumination}%` }}
                        />
                      </div>
                    </div>

                    <div className="md-col-bar-item">
                      <div className="md-col-bar-top">
                        <span>{lang === 'es' ? 'Comunicación' : 'Communication'}</span>
                        <strong>{kpi.subscores.communication}/100</strong>
                      </div>
                      <div className="md-mini-track">
                        <div
                          className="md-mini-fill viable"
                          style={{ width: `${kpi.subscores.communication}%` }}
                        />
                      </div>
                    </div>

                    <div className="md-col-bar-item">
                      <div className="md-col-bar-top">
                        <span>
                          {lang === 'es' ? 'Acimut y topografía' : 'Azimuth and topography'}
                        </span>
                        <strong>{kpi.subscores.azimuthTopography}/100</strong>
                      </div>
                      <div className="md-mini-track">
                        <div
                          className="md-mini-fill viable"
                          style={{ width: `${kpi.subscores.azimuthTopography}%` }}
                        />
                      </div>
                    </div>

                    <div className="md-col-bar-item">
                      <div className="md-col-bar-top">
                        <span>{lang === 'es' ? 'Ambiente' : 'Environment'}</span>
                        <strong>{kpi.subscores.environment}/100</strong>
                      </div>
                      <div className="md-mini-track">
                        <div
                          className="md-mini-fill viable"
                          style={{ width: `${kpi.subscores.environment}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Row 4: Pedagogical Sky Chart ("EXPLORA EL CIELO LUNAR" + "Luz solar y comunicación") */}
              <PedagogicalSkyChart report={report} sample={activeSample} lang={lang} />
            </>
          )}

          {/* =================================================================
              VIEW C: EDUCADOR (profileMode === 'educational')
              Matches Educator blocks in Diseños completos.pdf (dc_sheet3_kids.pdf)
             ================================================================= */}
          {profileMode === 'educational' && (
            <>
              {/* Row 1: Educator Context Card + Consolidated KPI */}
              <section className="md-exec-hero-grid">
                <div className="md-panel md-exec-site-summary">
                  <span className="md-eyebrow">
                    {lang === 'es'
                      ? 'MODO EDUCADOR · DIVULGACIÓN CIENTÍFICA'
                      : 'EDUCATOR MODE · SCIENTIFIC OUTREACH'}
                  </span>
                  <h2 className="md-display-title">{report.site.name}</h2>
                  <p className="md-exec-desc">{translateSiteDescription(report.site, lang)}</p>
                  <div className="md-exec-meta-row">
                    <span className="md-tag-pill">
                      {lang === 'es'
                        ? 'Guía interactiva sin saturación de tablas'
                        : 'Interactive guide without raw table overload'}
                    </span>
                    <span className="md-tag-pill">
                      {report.site.horizonSource === 'supuesto'
                        ? lang === 'es'
                          ? 'SPICE DE440 · horizonte supuesto'
                          : 'SPICE DE440 · assumed horizon'
                        : lang === 'es'
                          ? 'SPICE DE440 · horizonte liso'
                          : 'SPICE DE440 · smooth horizon'}
                    </span>
                  </div>
                </div>

                <div
                  className={`md-panel md-exec-kpi-card ${
                    kpi.verdict === 'GO'
                      ? 'viable'
                      : kpi.verdict === 'CAUTION'
                        ? 'marginal'
                        : 'no-go'
                  }`}
                >
                  <span className="md-eyebrow">
                    {lang === 'es' ? 'KPI DE VIABILIDAD CONSOLIDADO' : 'CONSOLIDATED VIABILITY KPI'}
                  </span>
                  <div className="md-exec-kpi-score-row">
                    <strong className="md-exec-kpi-big">{kpi.scorePct}%</strong>
                    <span className="md-exec-kpi-verdict">{kpi.verdict}</span>
                  </div>
                  <p className="md-caption">
                    {lang === 'es'
                      ? 'Integra iluminación solar, enlace a Tierra, topografía y clima espacial lunar.'
                      : 'Integrates solar light, Earth link, topography, and lunar space weather.'}
                  </p>
                </div>
              </section>

              {/* Row 2: 3 Didactic Concept Cards (Exact match to dc_sheet3_kids.pdf) */}
              <section className="md-edu-three-cards">
                <article className="md-panel md-edu-concept-card">
                  <span className="md-eyebrow">
                    {lang === 'es' ? '1 · PARÁMETROS ORBITALES' : '1 · ORBITAL PARAMETERS'}
                  </span>
                  <h3 className="md-h2">
                    {lang === 'es'
                      ? '¿Qué son el Acimut y la Elevación?'
                      : 'What are Azimuth and Elevation?'}
                  </h3>
                  <p className="md-edu-body">
                    {lang === 'es' ? (
                      <>
                        La <strong>Elevación</strong> mide qué tan alto está un astro sobre el
                        horizonte local: si es mayor a <code>0°</code> es visible; si es menor a{' '}
                        <code>0°</code> está oculto tras la Luna. En el Polo Sur Lunar, el Sol nunca
                        sube al cenit: roza el horizonte entre <strong>-3.7° y +6.7°</strong>,
                        creando sombras kilométricas. El <strong>Acimut (0°–360°)</strong> indica la
                        dirección en la brújula lunar hacia donde apuntar paneles solares y antenas.
                      </>
                    ) : (
                      <>
                        <strong>Elevation</strong> measures how high a body sits above the local
                        horizon: above <code>0°</code> it is visible; below <code>0°</code> it is
                        hidden behind the Moon. At the Lunar South Pole, the Sun never rises high
                        overhead: it grazes the horizon between <strong>-3.7° and +6.7°</strong>,
                        casting kilometer-long shadows. <strong>Azimuth (0°–360°)</strong> gives the
                        compass heading to aim solar arrays and antennas.
                      </>
                    )}
                  </p>
                </article>

                <article className="md-panel md-edu-concept-card">
                  <span className="md-eyebrow">
                    {lang === 'es'
                      ? '2 · LÍNEA DE VISIÓN TIERRA-LUNA'
                      : '2 · EARTH-MOON LINE OF SIGHT'}
                  </span>
                  <h3 className="md-h2">
                    {lang === 'es'
                      ? 'Libración Lunar y Sombra de Comunicación'
                      : 'Lunar Libration & Communication Shadow'}
                  </h3>
                  <p className="md-edu-body">
                    {lang === 'es' ? (
                      <>
                        Como la Luna tarda lo mismo en rotar sobre su eje que en orbitar la Tierra
                        (rotación síncrona), la Tierra parece flotar casi fija en el cielo lunar,
                        oscilando apenas <strong>±7° por libración</strong>. Si aterrizas dentro de
                        un cráter profundo cuyas paredes superan la elevación de la Tierra, quedas
                        en un <strong>punto ciego permanente</strong> sin radio directa con la
                        tripulación.
                      </>
                    ) : (
                      <>
                        Because the Moon rotates at the same rate it orbits Earth (synchronous
                        rotation), Earth appears almost stationary in the lunar sky, nodding only{' '}
                        <strong>±7° due to libration</strong>. If a lander touches down inside a
                        deep crater whose walls are taller than Earth&apos;s elevation angle, the
                        mission falls into a <strong>permanent communication blind spot</strong>.
                      </>
                    )}
                  </p>
                </article>

                <article className="md-panel md-edu-concept-card">
                  <span className="md-eyebrow">
                    {lang === 'es'
                      ? '3 · CLIMA ESPACIAL Y REINER GAMMA'
                      : '3 · SPACE WEATHER & REINER GAMMA'}
                  </span>
                  <h3 className="md-h2">
                    {lang === 'es'
                      ? 'Exosfera, polvo y remolinos magnéticos'
                      : 'Exosphere, dust and magnetic swirls'}
                  </h3>
                  <p className="md-edu-body">
                    {lang === 'es' ? (
                      <>
                        La Luna no tiene aire para respirar: solo una exosfera extremadamente tenue,
                        casi un vacío. En la frontera entre el día y la noche, la luz ultravioleta
                        puede cargar eléctricamente el polvo fino y hacerlo flotar. En{' '}
                        <strong>Reiner Gamma</strong> hay una anomalía magnética en la corteza que
                        desvía parte del viento solar; por eso ese suelo se ve más claro (un
                        «remolino lunar»).
                      </>
                    ) : (
                      <>
                        The Moon has no air to breathe: only an extremely thin exosphere, almost a
                        vacuum. Along the day/night boundary, ultraviolet light can charge fine dust
                        and make it float. At <strong>Reiner Gamma</strong> a magnetic anomaly in
                        the crust deflects part of the solar wind, which is why that ground looks
                        brighter (a «lunar swirl»).
                      </>
                    )}
                  </p>
                </article>
              </section>

              {/* Row 3: Pedagogical Sky Chart ("EXPLORA EL CIELO LUNAR" + "Luz solar y comunicación") */}
              <PedagogicalSkyChart report={report} sample={activeSample} lang={lang} />

              {/* Row 4: 6 Guided Metric Cards in a single row (Exact match to dc_sheet3_kids.pdf) */}
              <section className="md-six-metrics-row">
                <div className="md-panel md-edu-metric-card">
                  <span className="md-caption">
                    {lang === 'es'
                      ? 'Iluminación solar directa (SPICE)'
                      : 'Direct solar illumination (SPICE)'}
                  </span>
                  <strong className="md-edu-metric-val sun">
                    {report.metrics.sun_visible_pct}%
                  </strong>
                  <span className="md-caption">
                    {lang === 'es'
                      ? `Máx. continuo: ${report.metrics.longest_sun_window_hours} h`
                      : `Max continuous: ${report.metrics.longest_sun_window_hours} h`}
                  </span>
                </div>

                <div className="md-panel md-edu-metric-card">
                  <span className="md-caption">
                    {lang === 'es' ? 'Enlace directo a Tierra (LoS)' : 'Direct Earth link (LoS)'}
                  </span>
                  <strong className="md-edu-metric-val earth">
                    {report.metrics.earth_visible_pct}%
                  </strong>
                  <span className="md-caption">
                    {lang === 'es'
                      ? `Corte máx: ${report.metrics.longest_comm_gap_hours} h`
                      : `Max gap: ${report.metrics.longest_comm_gap_hours} h`}
                  </span>
                </div>

                <div className="md-panel md-edu-metric-card">
                  <span className="md-caption">
                    {lang === 'es'
                      ? 'Ventana simultánea Potencia + Enlace'
                      : 'Simultaneous Power + Link window'}
                  </span>
                  <strong className="md-edu-metric-val viable">
                    {report.metrics.both_visible_pct}%
                  </strong>
                  <span className="md-caption">
                    {lang === 'es'
                      ? 'Sol y Tierra sobre el horizonte'
                      : 'Both Sun & Earth above horizon'}
                  </span>
                </div>

                <div className="md-panel md-edu-metric-card">
                  <span className="md-caption">
                    {lang === 'es'
                      ? 'Velocidad circular de inserción orbital'
                      : 'Circular orbital insertion velocity'}
                  </span>
                  <strong className="md-edu-metric-val">
                    {kpi.kinematics.orbitalVelocityKmS} km/s
                  </strong>
                  <span className="md-caption">
                    {lang === 'es'
                      ? 'Órbita baja lunar (LLO · 100 km)'
                      : 'Low Lunar Orbit (LLO · 100 km)'}
                  </span>
                </div>

                <div className="md-panel md-edu-metric-card">
                  <span className="md-caption">
                    {lang === 'es'
                      ? 'Velocidad de escape/salida en superficie'
                      : 'Surface escape / departure velocity'}
                  </span>
                  <strong className="md-edu-metric-val">
                    {kpi.kinematics.escapeVelocityKmS} km/s
                  </strong>
                  <span className="md-caption">
                    {lang === 'es' ? 'Gravedad lunar: 1.62 m/s²' : 'Lunar gravity: 1.62 m/s²'}
                  </span>
                </div>

                <div className="md-panel md-edu-metric-card">
                  <span className="md-caption">
                    {lang === 'es' ? 'Altura máxima de la Tierra' : 'Highest Earth elevation'}
                  </span>
                  <strong className="md-edu-metric-val">
                    {report.metrics.max_earth_el.toFixed(1)}°
                  </strong>
                  <span className="md-caption">
                    {lang === 'es'
                      ? 'Más alta sobre el horizonte = enlace de radio más seguro'
                      : 'Higher above the horizon = safer radio link'}
                  </span>
                </div>
              </section>

              {/* Row 5: CONTEXT · Here vs. on Earth */}
              {renderHereVsEarthTable()}
            </>
          )}

          {/* =================================================================
              VIEW D: INFANTIL (profileMode === 'kids')
              Clean, friendly view for children — NO overwhelming technical tables!
              Matches Kids blocks in Diseños completos.pdf (dc_sheet3_kids.pdf)
             ================================================================= */}
          {profileMode === 'kids' && (
            <>
              {/* Row 1: Simple Kid-Friendly Mission Story + "¿Es un buen lugar para explorar?" Card */}
              <section className="md-kids-hero-grid">
                <div className="md-panel md-kids-story-card">
                  <span className="md-eyebrow">
                    🚀 {lang === 'es' ? 'MISIÓN EXPLORADOR LUNAR' : 'LUNAR EXPLORER MISSION'}
                  </span>
                  <h2 className="md-display-title">{report.site.name}</h2>
                  <p className="md-kids-story-text">
                    {report.site.id === 'shackleton-blindspot'
                      ? lang === 'es'
                        ? 'Este lugar está en el fondo de un cráter gigante en el Polo Sur de la Luna. Las montañas alrededor son tan altas que tapan la antena de radio con la Tierra y no dejan que el satélite nos tome fotos.'
                        : 'This spot sits at the bottom of a giant crater at the Moon’s South Pole. The surrounding mountains are so tall that they block our radio antenna to Earth and hide us from the camera satellite!'
                      : report.site.id === 'reiner-gamma'
                        ? lang === 'es'
                          ? '¡Este sitio tiene un remolino brillante que parece pintado sobre la Luna! Tiene un escudo magnético natural que protege a los astronautas y al robot explorador del polvo espacial.'
                          : 'This site features a bright swirl that looks painted on the Moon! It has a natural magnetic shield that protects astronauts and rovers from space dust.'
                        : lang === 'es'
                          ? 'Una montaña alta y plana cerca del Polo Sur de la Luna. Desde su cima podemos ver el Sol para recargar nuestras baterías solares y hablar por radio con nuestra familia en la Tierra.'
                          : 'A tall, flat mountain near the Moon’s South Pole. From the top we can see the Sun to charge our solar batteries and talk by radio with our family on Earth.'}
                  </p>
                </div>

                {/* Exact match to dc_sheet3_kids.pdf: "¿Es un buen lugar para explorar?" */}
                <div
                  className={`md-panel md-kids-question-card ${kpi.isViable ? 'viable' : 'not-viable'}`}
                >
                  <div className="md-kids-question-top">
                    <h3 className="md-kids-question-title">
                      {lang === 'es'
                        ? '¿Es un buen lugar para explorar?'
                        : 'Is this a good place to explore?'}
                    </h3>
                    <span className="md-tag-pill">
                      {lang === 'es' ? 'Estimación del modelo' : 'Team model estimate'}
                    </span>
                  </div>

                  <div className="md-kids-score-big">{kpi.scorePct}%</div>
                  <p className="md-caption">
                    {lang === 'es'
                      ? `Es como una nota de ${kpi.scorePct} sobre 100.`
                      : `That is like getting a score of ${kpi.scorePct} out of 100.`}
                  </p>

                  <p className="md-kids-verdict-phrase">
                    {kpi.isViable
                      ? lang === 'es'
                        ? '¡Parece una buena opción!'
                        : 'Looks like a great choice!'
                      : lang === 'es'
                        ? '¡Aquí no podemos aterrizar!'
                        : 'We cannot land here!'}
                  </p>
                  <p className="md-caption">
                    {kpi.isViable
                      ? lang === 'es'
                        ? 'Pero antes de ir, hay que revisar más cosas.'
                        : 'Before we launch, let’s check the 3 mission rules below.'
                      : lang === 'es'
                        ? 'Las paredes del cráter tapan la señal con la Tierra. ¡Prueba Reiner Gamma!'
                        : 'Crater walls block the signal to Earth. Try Reiner Gamma!'}
                  </p>
                </div>
              </section>

              {/* Row 2: 3 Simple Visual Check Cards for Kids */}
              <section className="md-kids-three-checks">
                <div
                  className={`md-panel md-kids-check-tile ${
                    report.metrics.sun_visible_pct > 20 ? 'yes' : 'no'
                  }`}
                >
                  <span className="md-kids-emoji">☀️</span>
                  <h4>
                    {lang === 'es'
                      ? '1. ¿Hay luz del Sol para nuestras baterías?'
                      : '1. Is there sunlight for our batteries?'}
                  </h4>
                  <strong className="md-kids-answer">
                    {report.metrics.sun_visible_pct > 20
                      ? lang === 'es'
                        ? '¡Sí! Hay Sol para recargar'
                        : 'Yes! Plenty of sunlight'
                      : lang === 'es'
                        ? '¡Muy poca luz!'
                        : 'Too dark!'}
                  </strong>
                </div>

                <div className={`md-panel md-kids-check-tile ${kpi.commLinkOk ? 'yes' : 'no'}`}>
                  <span className="md-kids-emoji">🌍</span>
                  <h4>
                    {lang === 'es'
                      ? '2. ¿Podemos hablar por radio con la Tierra?'
                      : '2. Can we talk by radio with Earth?'}
                  </h4>
                  <strong className="md-kids-answer">
                    {kpi.commLinkOk
                      ? lang === 'es'
                        ? '¡Sí! La Tierra se ve en el cielo'
                        : 'Yes! Earth is visible in the sky'
                      : lang === 'es'
                        ? '¡No! Las montañas tapan la radio'
                        : 'No! Mountains block the radio'}
                  </strong>
                </div>

                <div
                  className={`md-panel md-kids-check-tile ${kpi.orbiterPhotoLoS ? 'yes' : 'no'}`}
                >
                  <span className="md-kids-emoji">🛰️</span>
                  <h4>
                    {lang === 'es'
                      ? '3. ¿El satélite nos puede tomar fotos?'
                      : '3. Can the satellite take photos of us?'}
                  </h4>
                  <strong className="md-kids-answer">
                    {kpi.orbiterPhotoLoS
                      ? lang === 'es'
                        ? '¡Sí, según nuestro modelo!'
                        : 'Yes, according to our model!'
                      : lang === 'es'
                        ? '¡No! Estamos en un punto ciego'
                        : 'No! Hidden in a blind spot'}
                  </strong>
                </div>
              </section>

              {/* Row 3: Interactive Rocket Velocity Vector Playground */}
              <RocketVectorPlayground
                site={report.site}
                viability={kpi}
                lang={lang}
                hideTopVerdict={true}
              />

              {/* Row 4: Simple "Aquí vs. en la Tierra" comparison */}
              {renderHereVsEarthTable()}
            </>
          )}
        </main>
      )}

      {/* =====================================================================
          SCREEN 3: COMPARAR ("Compare scenarios" — Real Photographic Moons)
         ===================================================================== */}
      {activeTab === 'compare' && (
        <main className="md-main">
          <header className="md-page-header">
            <div>
              <p className="md-eyebrow">
                {lang === 'es'
                  ? 'POLO SUR LUNAR · ANÁLISIS DE ESCENARIO'
                  : 'LUNAR SOUTH POLE · SCENARIO ANALYSIS'}
              </p>
              <h1 className="md-display-title">
                {lang === 'es' ? 'Comparar escenarios' : 'Compare scenarios'}
              </h1>
              <p className="md-subtitle">
                {lang === 'es'
                  ? 'Sitios evaluados sobre la misma ventana operativa'
                  : 'Sites over the same analysis window'}
              </p>
            </div>
          </header>

          {/* 4-Column Compare Strip */}
          <section className="md-scenario-strip">
            <div className="md-strip-cell">
              <span className="md-label">
                {lang === 'es' ? 'SITIO DE ALUNIZAJE' : 'LANDING SITE'}
              </span>
              <select
                value={compareLeftId}
                onChange={(e) => {
                  updateCompareSiteA(e.target.value)
                  setSiteId(e.target.value)
                }}
                className="md-strip-select"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md-strip-cell">
              <span className="md-label">{lang === 'es' ? 'VENTANA BASE' : 'BASE WINDOW'}</span>
              <strong className="md-strip-val">14 NOV 2026</strong>
            </div>

            <div className="md-strip-cell">
              <span className="md-label">
                {lang === 'es' ? 'AJUSTE PROPUESTO' : 'PROPOSED SHIFT'}
              </span>
              <div className="md-delay-stepper">
                <button
                  type="button"
                  onClick={() => setDelayDays((d) => Math.max(0, d - 1))}
                  aria-label={lang === 'es' ? 'Reducir días de retraso' : 'Decrease delay days'}
                >
                  −
                </button>
                <strong className="md-earth-text">
                  {delayDays >= 0
                    ? `+${delayDays} ${lang === 'es' ? 'días' : 'days'}`
                    : `${delayDays} ${lang === 'es' ? 'días' : 'days'}`}
                </strong>
                <button
                  type="button"
                  onClick={() => setDelayDays((d) => Math.min(28, d + 1))}
                  aria-label={lang === 'es' ? 'Aumentar días de retraso' : 'Increase delay days'}
                >
                  +
                </button>
              </div>
            </div>

            <div className="md-strip-cell sync-cell">
              <span className="md-sync-status">
                <i className="md-sync-dot" />{' '}
                {lang === 'es' ? 'SIMULACIÓN SINCRONIZADA' : 'SYNCHRONIZED SIMULATION'}
              </span>
            </div>
          </section>

          {/* 3 Separate Real Photographic Moon Cards + "Comparación de métricas" + "Comparar fechas" */}
          {compareLeftData && compareRightData && (
            <ThreeMoonsComparisonSection
              sites={sites}
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
              lang={lang}
            />
          )}

          {/* Bottom Interactive Dashboard (Verdict Banner + Posición orbital + 3 KPIs + ¿Qué pasaría si...?) */}
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
                    <span className="md-label">
                      {lang === 'es' ? 'VEREDICTO DE VIABILIDAD' : 'VIABILITY VERDICT'}
                    </span>
                    <h2 className="md-verdict-hero-title">
                      ●{' '}
                      {focusedCompareStats.verdict === 'GO'
                        ? lang === 'es'
                          ? 'Viable'
                          : 'Viable'
                        : focusedCompareStats.verdict === 'CAUTION'
                          ? lang === 'es'
                            ? 'Condicional'
                            : 'Conditional'
                          : lang === 'es'
                            ? 'No Viable'
                            : 'Not Viable'}
                    </h2>
                    <p className="md-caption">
                      {focusedCompareStats.vetoReason
                        ? lang === 'es'
                          ? focusedCompareStats.vetoReason
                          : 'Ruled out due to critical loss of line-of-sight with Earth and orbital blind spot.'
                        : lang === 'es'
                          ? 'Iluminación estable y enlace directo a la Tierra dentro de la ventana operativa.'
                          : 'Stable illumination and direct Earth link within the operational window.'}
                    </p>
                  </div>
                </div>

                <div className="md-verdict-hero-checks">
                  <span>✓ {lang === 'es' ? 'Amanecer' : 'Sunrise'}</span>
                  <span>
                    {focusedCompareStats.blindSpotDetected
                      ? lang === 'es'
                        ? '× Sin línea a Tierra'
                        : '× No Earth line-of-sight'
                      : lang === 'es'
                        ? '✓ Tierra a la vista'
                        : '✓ Earth in view'}
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
                  lang={lang}
                />

                <div className="md-navigator-right-stack">
                  {/* 3 KPI Mini-Cards */}
                  <div className="md-three-kpi-cards">
                    <div className="md-panel md-mini-kpi">
                      <span className="md-mini-kpi-icon">☀️</span>
                      <div>
                        <span className="md-label">
                          {lang === 'es' ? 'PRÓXIMO AMANECER' : 'NEXT SUNRISE'}
                        </span>
                        <strong className="md-mini-kpi-val">
                          {focusedCompareStats.nextSunDelta}
                        </strong>
                        <span className="md-caption">
                          {lang === 'es' ? 'Ventana solar' : 'Solar window'}
                        </span>
                      </div>
                    </div>

                    <div className="md-panel md-mini-kpi">
                      <span className="md-mini-kpi-icon">🕒</span>
                      <div>
                        <span className="md-label">
                          {lang === 'es' ? 'LUZ CONTINUA' : 'CONTINUOUS LIGHT'}
                        </span>
                        <strong className="md-mini-kpi-val">
                          {focusedCompareStats.contLightDelta}
                        </strong>
                        <span className="md-caption">
                          {lang === 'es' ? 'Duración estimada' : 'Estimated duration'}
                        </span>
                      </div>
                    </div>

                    <div className="md-panel md-mini-kpi">
                      <span className="md-mini-kpi-icon">🌍</span>
                      <div>
                        <span className="md-label">
                          {lang === 'es' ? 'TIERRA VISIBLE' : 'EARTH VISIBLE'}
                        </span>
                        <strong className="md-mini-kpi-val">{focusedCompareStats.earthPct}%</strong>
                        <span className="md-caption">
                          {lang === 'es' ? 'Línea de visión' : 'Line of sight'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ANÁLISIS DE SENSIBILIDAD · ¿Qué pasaría si...? */}
                  <div className="md-panel md-sensitivity-card">
                    <div className="md-panel-header-row">
                      <div>
                        <span className="md-eyebrow">
                          {lang === 'es' ? 'ANÁLISIS DE SENSIBILIDAD' : 'SENSITIVITY ANALYSIS'}
                        </span>
                        <h3 className="md-h2">
                          {lang === 'es' ? '¿Qué pasaría si...?' : 'What if we delay?'}
                        </h3>
                      </div>
                      <span className="md-tag-pill">
                        {lang === 'es' ? `RETRASO +${delayDays} DÍAS` : `DELAY +${delayDays} DAYS`}
                      </span>
                    </div>

                    <div className="md-sensitivity-slider-block">
                      <div className="md-sensitivity-slider-labels">
                        <span>{lang === 'es' ? 'Retrasar el alunizaje' : 'Delay landing'}</span>
                        <strong>
                          {delayDays} {lang === 'es' ? 'días' : 'days'}
                        </strong>
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
                        <span>28 {lang === 'es' ? 'días' : 'days'}</span>
                      </div>
                    </div>

                    <div className="md-sensitivity-bars">
                      <div className="md-sens-bar-row">
                        <div className="md-sens-bar-meta">
                          <span>
                            ☀️ {lang === 'es' ? 'Iluminación solar' : 'Solar illumination'}
                          </span>
                          <small>
                            {focusedCompareStats.sunPct}%{' '}
                            {lang === 'es' ? 'disponible' : 'available'}
                          </small>
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
                          <span>
                            🌍 {lang === 'es' ? 'Enlace con la Tierra' : 'Earth communication link'}
                          </span>
                          <small>
                            {focusedCompareStats.earthPct}%{' '}
                            {lang === 'es' ? 'de visibilidad' : 'visibility'}
                          </small>
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
                      <div
                        className="md-abc-switcher"
                        role="group"
                        aria-label={lang === 'es' ? 'Sitio analizado' : 'Analyzed site'}
                      >
                        <button
                          type="button"
                          className={compareSlot === 'A' ? 'md-abc-btn active' : 'md-abc-btn'}
                          onClick={() => setCompareSlot('A')}
                        >
                          A ·{' '}
                          {compareLeftData?.site.name.split(' ')[0] ??
                            (lang === 'es' ? 'Sitio A' : 'Site A')}
                        </button>
                        <button
                          type="button"
                          className={compareSlot === 'B' ? 'md-abc-btn active-light' : 'md-abc-btn'}
                          onClick={() => setCompareSlot('B')}
                        >
                          B ·{' '}
                          {compareRightData?.site.name.split(' ')[0] ??
                            (lang === 'es' ? 'Sitio B' : 'Site B')}
                        </button>
                        <button
                          type="button"
                          className={compareSlot === 'C' ? 'md-abc-btn active' : 'md-abc-btn'}
                          onClick={() => {
                            if (!compareThirdId) {
                              const fallbackC =
                                sites.find((s) => s.id !== compareLeftId && s.id !== compareRightId)
                                  ?.id ?? 'apollo11'
                              updateCompareSiteC(fallbackC)
                            }
                            setCompareSlot('C')
                          }}
                        >
                          C ·{' '}
                          {compareThirdData
                            ? compareThirdData.site.name.split(' ')[0]
                            : lang === 'es'
                              ? 'vacío'
                              : 'empty'}
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
          SCREEN 4: ACERCA DE LOS DATOS ("About the data" — Matches dc_about.pdf)
         ===================================================================== */}
      {activeTab === 'about' && (
        <main className="md-main">
          <header className="md-page-header">
            <div>
              <p className="md-eyebrow">
                {lang === 'es' ? 'METODOLOGÍA Y FUENTES' : 'METHODS & SOURCES'}
              </p>
              <h1 className="md-display-title">
                {lang === 'es' ? 'Acerca de los datos' : 'About the data'}
              </h1>
              <p className="md-subtitle">
                {lang === 'es'
                  ? 'Cada número tiene una etiqueta de origen: Efemérides (SPICE DE440 / AWS JPL Horizons), Entrada del modelo o Estimación del modelo.'
                  : 'Every number has a source tag: Ephemeris (SPICE DE440 / AWS JPL Horizons), Model input, or Team model estimate.'}
              </p>
            </div>
            <div className="md-page-header-right">
              <button
                type="button"
                className="md-btn primary"
                onClick={() => setShowArchModal(true)}
              >
                {lang === 'es'
                  ? 'Abrir Consola API AWS & Snippet →'
                  : 'Open AWS API Console & Snippet →'}
              </button>
            </div>
          </header>

          <div className="md-about-stack">
            {/* Block 1: PRIMARY REFERENCES · NASA sources */}
            <section className="md-panel">
              <div className="md-panel-header-row">
                <div>
                  <span className="md-eyebrow">
                    {lang === 'es' ? 'REFERENCIAS PRIMARIAS' : 'PRIMARY REFERENCES'}
                  </span>
                  <h2 className="md-h2">
                    {lang === 'es' ? 'Fuentes oficiales de la NASA' : 'NASA sources'}
                  </h2>
                </div>
                <span className="md-tag-pill">NAIF · JPL · LRO</span>
              </div>

              <div className="md-about-sources-list">
                <div className="md-about-source-row">
                  <div>
                    <strong>NASA NAIF — SPICE Toolkit &amp; Generic Kernels</strong>
                    <p className="md-caption">
                      <code>de440s.bsp</code>, <code>moon_pa_de440_200625.bpc</code>,{' '}
                      <code>moon_de440_250416.tf</code>, <code>naif0012.tls</code>,{' '}
                      <code>pck00011.tpc</code>
                    </p>
                  </div>
                  <a
                    href="https://naif.jpl.nasa.gov/pub/naif/generic_kernels/"
                    target="_blank"
                    rel="noreferrer"
                    className="md-link-btn"
                  >
                    naif.jpl.nasa.gov ↗
                  </a>
                </div>

                <div className="md-about-source-row">
                  <div>
                    <strong>NASA JPL — Solar System Dynamics Horizons System</strong>
                    <p className="md-caption">
                      {lang === 'es'
                        ? 'Validación cruzada independiente de acimut y elevación topocéntrica sincronizada en AWS EC2 PostgreSQL 16.'
                        : 'Independent topocentric azimuth/elevation cross-check synchronized in AWS EC2 PostgreSQL 16.'}
                    </p>
                  </div>
                  <a
                    href="https://ssd.jpl.nasa.gov/horizons/"
                    target="_blank"
                    rel="noreferrer"
                    className="md-link-btn"
                  >
                    ssd.jpl.nasa.gov ↗
                  </a>
                </div>

                <div className="md-about-source-row">
                  <div>
                    <strong>LRO LOLA — Lunar Orbiter Laser Altimeter GDR</strong>
                    <p className="md-caption">
                      {lang === 'es'
                        ? 'Siguiente paso: perfiles de horizonte medidos con LOLA. Hoy los sitios usan horizonte liso y el de Shackleton es un supuesto, marcado como tal.'
                        : 'Next step: horizon profiles measured with LOLA. Today the sites use a smooth horizon and the Shackleton one is an assumption, labelled as such.'}
                    </p>
                  </div>
                  <a
                    href="https://imbrium.mit.edu/"
                    target="_blank"
                    rel="noreferrer"
                    className="md-link-btn"
                  >
                    imbrium.mit.edu ↗
                  </a>
                </div>
              </div>
            </section>

            {/* Block 2: COMPUTATION ENGINE · SPICE (NASA/NAIF) with DE440 */}
            <section className="md-panel">
              <div className="md-panel-header-row">
                <div>
                  <span className="md-eyebrow">
                    {lang === 'es' ? 'MOTOR DE CÓMPUTO' : 'COMPUTATION ENGINE'}
                  </span>
                  <h2 className="md-h2">
                    {lang === 'es'
                      ? 'SPICE (NASA/NAIF) con efemérides DE440'
                      : 'SPICE (NASA/NAIF) with DE440'}
                  </h2>
                </div>
                <span className="md-tag-pill">MOON_ME (LT+S)</span>
              </div>
              <p className="md-caption">
                {lang === 'es'
                  ? 'Calculamos vectores de estado topocéntricos horarios en el marco lunar de eje medio MOON_ME con corrección de tiempo-luz y aberración estelar (LT+S), radio ecuatorial lunar de 1737.4 km y detección de cruces de horizonte por bisección al segundo.'
                  : 'We compute hourly topocentric state vectors in the MOON_ME mean-axis lunar frame with light-time and stellar aberration correction (LT+S), a 1737.4 km lunar reference radius, and second-level bisection root-finding for horizon crossings.'}
              </p>
            </section>

            {/* Block 3: INDEPENDENT CHECK · Check against JPL Horizons + Live AWS EC2 */}
            <section className="md-panel">
              <div className="md-panel-header-row">
                <div>
                  <span className="md-eyebrow">
                    {lang === 'es' ? 'VERIFICACIÓN INDEPENDIENTE' : 'INDEPENDENT CHECK'}
                  </span>
                  <h2 className="md-h2">
                    {lang === 'es'
                      ? 'Comprobación contra JPL Horizons en AWS EC2 PostgreSQL'
                      : 'Check against JPL Horizons on AWS EC2 PostgreSQL'}
                  </h2>
                </div>
                <span className="md-tag-pill">
                  {awsTelemetry.horizonsRecords.toLocaleString()}{' '}
                  {lang === 'es' ? 'registros en AWS' : 'rows on AWS'}
                </span>
              </div>
              <p className="md-caption">
                {lang === 'es'
                  ? `Comparamos cada hora del mes, en los ${SITES.length} sitios del catálogo, la posición del Sol y de la Tierra calculada con nuestro motor SPICE contra la que da NASA/JPL Horizons. Los registros de Horizons también se guardan en PostgreSQL en ${AWS_BASE_URL}.`
                  : `For every hour of the month at the ${SITES.length} catalog sites, we compare the Sun and Earth positions from our SPICE engine with those from NASA/JPL Horizons. The Horizons records are also stored in PostgreSQL at ${AWS_BASE_URL}.`}
              </p>
              <div className="md-about-metrics-strip">
                <div>
                  <span className="md-label">
                    {lang === 'es'
                      ? 'DIFERENCIA MÁXIMA EN ELEVACIÓN'
                      : 'LARGEST ELEVATION DIFFERENCE'}
                  </span>
                  <strong>{validation ? `${validation.max_el_diff_deg.toFixed(6)}°` : '—'}</strong>
                </div>
                <div>
                  <span className="md-label">
                    {lang === 'es' ? 'COMPARACIONES' : 'COMPARISONS'}
                  </span>
                  <strong>
                    {validation
                      ? `${validation.comparisons.toLocaleString(lang === 'es' ? 'es-MX' : 'en-US')}`
                      : '—'}
                  </strong>
                </div>
                <div>
                  <span className="md-label">
                    {lang === 'es' ? 'CONSULTA AWS POSTGRESQL' : 'AWS POSTGRESQL QUERY'}
                  </span>
                  <strong>{awsTelemetry.dbQueryMs.toFixed(2)} ms</strong>
                </div>
                <div>
                  <span className="md-label">
                    {lang === 'es' ? 'DOCUMENTACIÓN SWAGGER' : 'SWAGGER DOCS'}
                  </span>
                  <a href={`${AWS_BASE_URL}/docs`} target="_blank" rel="noreferrer">
                    {AWS_BASE_URL}/docs ↗
                  </a>
                </div>
              </div>
            </section>

            {/* Block 4: DISCLOSURE · How we used AI & Academic Advisory */}
            <section className="md-panel">
              <div className="md-panel-header-row">
                <div>
                  <span className="md-eyebrow">
                    {lang === 'es'
                      ? 'TRANSPARENCIA Y COMITÉ ACADÉMICO'
                      : 'DISCLOSURE & ACADEMIC ADVISORY'}
                  </span>
                  <h2 className="md-h2">
                    {lang === 'es'
                      ? 'Validación académica y uso responsable de herramientas'
                      : 'Academic validation & how we used AI'}
                  </h2>
                </div>
                <span className="md-tag-pill">Universidad Politécnica</span>
              </div>
              <p className="md-caption">
                {lang === 'es'
                  ? 'Todos los cálculos orbitales provienen determinísticamente de kernels SPICE DE440 de NASA/NAIF y consultas reales a JPL Horizons en AWS PostgreSQL. Respaldado por el comité asesor de la Universidad Politécnica: Dr. Horacio (Kernel y Programación), Prof. Jorge y Dr. Manuel Martínez (Telemetría), Dr. Mendoza y Dr. Montero (Física Teórica y Probabilidad).'
                  : 'All orbital calculations come deterministically from official NASA/NAIF SPICE DE440 kernels and live JPL Horizons queries in AWS PostgreSQL. Backed by the Universidad Politécnica advisory board: Dr. Horacio (Kernel & Software), Prof. Jorge & Dr. Manuel Martínez (Telemetry), Dr. Mendoza & Dr. Montero (Theoretical Physics & Probability).'}
              </p>
            </section>
          </div>
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
          userName={user.name.split(' ')[0]}
          otherSites={Object.values(allSitesData)
            .filter((d) => d.report.site.id !== report.site.id && d.report.viability)
            .map((d) => ({
              id: d.report.site.id,
              name: d.report.site.name,
              score: d.report.viability!.scorePct,
              verdict: d.report.viability!.verdict,
            }))}
          onSelectSiteId={(id: string) => setSiteId(id)}
          lang={lang}
        />
      )}
    </div>
  )
}
export default App
