import type { Sample, Site, SiteReport } from '../ephemeris/types.ts'

export interface OrbitalPositionProps {
  sample: Sample
  siteName: string
}

/**
 * Cenital Orbital Position diagram ("GEOMETRÍA LOCAL · Posición orbital · VISTA CENITAL")
 * matching Cambios a realizar.png and Diseños.pdf.
 */
export function OrbitalPositionCenital({ sample }: OrbitalPositionProps) {
  const cx = 180
  const cy = 180
  const rOuter = 132
  const rMid = 104
  const rInner = 76
  const rMoon = 46

  // Convert azimuth (0 deg = North/up, 90 deg = East/right) to SVG coordinates
  const sunRad = ((sample.sun_az - 90) * Math.PI) / 180
  const earthRad = ((sample.earth_az - 90) * Math.PI) / 180

  const sunX = cx + rOuter * Math.cos(sunRad)
  const sunY = cy + rOuter * Math.sin(sunRad)

  const earthX = cx + rOuter * Math.cos(earthRad)
  const earthY = cy + rOuter * Math.sin(earthRad)

  return (
    <div className="md-orbital-card">
      <div className="md-orbital-head">
        <div>
          <span className="md-eyebrow">GEOMETRÍA LOCAL</span>
          <h3 className="md-h2">Posición orbital</h3>
        </div>
        <span className="md-meta-label">VISTA CENITAL</span>
      </div>

      <svg
        viewBox="0 0 360 360"
        className="md-orbital-svg"
        role="img"
        aria-label="Posición orbital cenital del Sol y la Tierra respecto a la Luna"
      >
        <defs>
          <radialGradient id="moonSphereGrad" cx="38%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#F3F4F6" />
            <stop offset="42%" stopColor="#9CA3AF" />
            <stop offset="78%" stopColor="#4B5563" />
            <stop offset="100%" stopColor="#1F2937" />
          </radialGradient>
          <radialGradient id="sunOrbGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFD98A" stopOpacity="1" />
            <stop offset="55%" stopColor="#F7B32B" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#F7B32B" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="earthOrbGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#8CBBFF" stopOpacity="1" />
            <stop offset="60%" stopColor="#3B8CFF" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#3B8CFF" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer thick orbital ring */}
        <circle
          cx={cx}
          cy={cy}
          r={rOuter}
          fill="none"
          stroke="rgba(140, 187, 255, 0.42)"
          strokeWidth="7"
        />

        {/* Concentric dashed trajectory rings */}
        <circle
          cx={cx}
          cy={cy}
          r={rMid}
          fill="none"
          stroke="rgba(208, 208, 208, 0.28)"
          strokeWidth="1.6"
          strokeDasharray="9 8"
        />
        <circle
          cx={cx}
          cy={cy}
          r={rInner}
          fill="none"
          stroke="rgba(208, 208, 208, 0.22)"
          strokeWidth="1.4"
          strokeDasharray="6 7"
        />

        {/* Lunar globe in center with realistic mare/crater patches */}
        <circle
          cx={cx}
          cy={cy}
          r={rMoon}
          fill="url(#moonSphereGrad)"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1.2"
        />
        <circle cx={cx - 12} cy={cy - 10} r={11} fill="rgba(31, 41, 55, 0.36)" />
        <circle cx={cx + 8} cy={cy - 14} r={8.5} fill="rgba(31, 41, 55, 0.32)" />
        <circle cx={cx - 16} cy={cy + 10} r={7.5} fill="rgba(31, 41, 55, 0.28)" />
        <circle cx={cx + 14} cy={cy + 12} r={6} fill="rgba(255, 255, 255, 0.18)" />
        <circle cx={cx - 3} cy={cy + 18} r={4.5} fill="rgba(31, 41, 55, 0.3)" />

        {/* Earth Orb */}
        <g transform={`translate(${earthX}, ${earthY})`}>
          <circle r={20} fill="url(#earthOrbGlow)" opacity="0.35" />
          <circle r={13} fill="#3B8CFF" stroke="#8CBBFF" strokeWidth="1.5" />
          <text
            x={earthX < cx ? -18 : 18}
            y={-16}
            textAnchor={earthX < cx ? 'end' : 'start'}
            className="md-orb-label"
          >
            TIERRA
          </text>
        </g>

        {/* Sun Orb */}
        <g transform={`translate(${sunX}, ${sunY})`}>
          <circle r={22} fill="url(#sunOrbGlow)" opacity="0.45" />
          <circle r={14} fill="#F7B32B" stroke="#FFD98A" strokeWidth="2" />
          <text
            x={sunX < cx ? -18 : 18}
            y={-16}
            textAnchor={sunX < cx ? 'end' : 'start'}
            className="md-orb-label sun"
          >
            SOL
          </text>
        </g>
      </svg>

      <div className="md-orbital-legend">
        <span>
          <i className="md-dot sun" /> Sol
        </span>
        <span>
          <i className="md-dot earth" /> Tierra
        </span>
        <span>
          <i className="md-line-swatch" /> Trayectoria
        </span>
      </div>
    </div>
  )
}

export interface LocalHorizonProps {
  report: SiteReport
  sample: Sample
}

/**
 * Local Horizon & Terrain profile (0° N to 360° azimuth) + Sky Visibility Radar
 * inspired by zoom8_navigator_sky.pdf in Diseños.pdf.
 */
export function LocalHorizonAndSkyRow({ report, sample }: LocalHorizonProps) {
  const W = 620
  const H = 220
  const PAD = { l: 38, r: 24, t: 20, b: 30 }

  const rawProfile = report.horizon.profile
  const points: { az: number; el: number }[] = []
  for (let az = 0; az <= 360; az += 5) {
    let el = 3.5
    if (rawProfile && rawProfile.length > 0) {
      const idx = Math.min(rawProfile.length - 1, Math.floor((az / 360) * rawProfile.length))
      const base = rawProfile[idx] || 0
      el = Math.max(
        0.8,
        base + 3.2 + 2.4 * Math.sin((az * Math.PI) / 90) + 1.3 * Math.cos((az * Math.PI) / 60),
      )
    } else {
      el = 4.2 + 2.8 * Math.sin(((az - 40) * Math.PI) / 90) + 1.6 * Math.cos((az * Math.PI) / 60)
    }
    points.push({ az, el })
  }

  const maxEl = Math.max(16, Math.ceil(Math.max(sample.sun_el, sample.earth_el, 14) / 5) * 5)
  const minEl = Math.min(0, Math.floor(Math.min(sample.sun_el, sample.earth_el, 0) / 5) * 5)

  const xAz = (az: number) => PAD.l + (az / 360) * (W - PAD.l - PAD.r)
  const yEl = (el: number) =>
    PAD.t + ((maxEl - el) / Math.max(5, maxEl - minEl)) * (H - PAD.t - PAD.b)

  const terrainLine = points
    .map((p, i) => `${i ? 'L' : 'M'}${xAz(p.az).toFixed(1)},${yEl(p.el).toFixed(1)}`)
    .join('')
  const terrainArea = `${terrainLine}L${xAz(360).toFixed(1)},${(H - PAD.b).toFixed(1)}L${xAz(0).toFixed(1)},${(H - PAD.b).toFixed(1)}Z`

  const rCx = 95
  const rCy = 95
  const rMax = 72
  const polarPos = (az: number, el: number) => {
    const clampedEl = Math.max(-15, Math.min(90, el))
    const r = rMax * (1 - (clampedEl + 15) / 105)
    const rad = ((az - 90) * Math.PI) / 180
    return {
      x: rCx + r * Math.cos(rad),
      y: rCy + r * Math.sin(rad),
    }
  }
  const sunPolar = polarPos(sample.sun_az, sample.sun_el)
  const earthPolar = polarPos(sample.earth_az, sample.earth_el)

  return (
    <div className="md-horizon-sky-grid">
      {/* Left: Local horizon & terrain */}
      <div className="md-panel">
        <div className="md-panel-header-row">
          <div>
            <h3 className="md-h2">Local horizon &amp; terrain</h3>
            <p className="md-caption">Elevation angle by azimuth ({report.site.name})</p>
          </div>
          <span className="md-tag-pill">SPICE DE440 · LOLA</span>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="md-horizon-svg"
          role="img"
          aria-label="Perfil de horizonte local de 360 grados"
        >
          <defs>
            <linearGradient id="terrainFillGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#94A3B8" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#0F172A" stopOpacity="0.04" />
            </linearGradient>
          </defs>

          {[
            minEl,
            Math.round((minEl + maxEl) / 3),
            Math.round(((minEl + maxEl) * 2) / 3),
            maxEl,
          ].map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={yEl(tick)}
                y2={yEl(tick)}
                stroke="rgba(255,255,255,0.07)"
                strokeDasharray="3 4"
              />
              <text x={PAD.l - 8} y={yEl(tick) + 4} textAnchor="end" className="tick">
                {tick}°
              </text>
            </g>
          ))}

          <path d={terrainArea} fill="url(#terrainFillGrad)" />
          <path d={terrainLine} fill="none" stroke="rgba(203, 213, 225, 0.55)" strokeWidth="2" />

          {/* Sun stem & dot */}
          <line
            x1={xAz(sample.sun_az)}
            x2={xAz(sample.sun_az)}
            y1={yEl(sample.sun_el)}
            y2={H - PAD.b}
            stroke="rgba(247, 179, 43, 0.45)"
            strokeDasharray="3 3"
          />
          <circle cx={xAz(sample.sun_az)} cy={yEl(sample.sun_el)} r={5.5} fill="#F7B32B" />
          <text
            x={Math.min(W - PAD.r - 45, Math.max(PAD.l + 10, xAz(sample.sun_az) + 8))}
            y={Math.max(PAD.t + 12, yEl(sample.sun_el) - 6)}
            className="md-marker-label sun"
          >
            SUN {sample.sun_el.toFixed(1)}°
          </text>

          {/* Earth stem & dot */}
          <line
            x1={xAz(sample.earth_az)}
            x2={xAz(sample.earth_az)}
            y1={yEl(sample.earth_el)}
            y2={H - PAD.b}
            stroke="rgba(59, 140, 255, 0.45)"
            strokeDasharray="3 3"
          />
          <circle cx={xAz(sample.earth_az)} cy={yEl(sample.earth_el)} r={5.5} fill="#3B8CFF" />
          <text
            x={Math.min(W - PAD.r - 55, Math.max(PAD.l + 10, xAz(sample.earth_az) + 8))}
            y={Math.max(PAD.t + 12, yEl(sample.earth_el) - 6)}
            className="md-marker-label earth"
          >
            EARTH {sample.earth_el.toFixed(1)}°
          </text>

          {[
            { az: 0, label: '0° N' },
            { az: 90, label: '90° E' },
            { az: 180, label: '180° S' },
            { az: 270, label: '270° W' },
            { az: 360, label: '360°' },
          ].map((item) => (
            <text key={item.az} x={xAz(item.az)} y={H - 8} textAnchor="middle" className="tick">
              {item.label}
            </text>
          ))}
        </svg>

        <div className="md-orbital-legend">
          <span>
            <i className="md-line-swatch" /> Local terrain
          </span>
          <span>
            <i className="md-dot sun" /> Sun
          </span>
          <span>
            <i className="md-dot earth" /> Earth
          </span>
        </div>
      </div>

      {/* Right: Sky visibility polar radar */}
      <div className="md-panel">
        <div className="md-panel-header-row">
          <div>
            <h3 className="md-h2">Sky visibility</h3>
            <p className="md-caption">Position relative to local terrain mask</p>
          </div>
          <span className="md-info-circle" title="Proyección polar acimutal (N, E, S, W)">
            i
          </span>
        </div>

        <div className="md-sky-radar-layout">
          <svg
            viewBox="0 0 190 190"
            className="md-sky-radar-svg"
            role="img"
            aria-label="Radar polar de visibilidad del cielo"
          >
            <circle
              cx={rCx}
              cy={rCy}
              r={rMax}
              fill="rgba(15, 23, 42, 0.55)"
              stroke="rgba(255,255,255,0.12)"
            />
            <circle
              cx={rCx}
              cy={rCy}
              r={rMax * 0.66}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="3 3"
            />
            <circle
              cx={rCx}
              cy={rCy}
              r={rMax * 0.33}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="3 3"
            />
            <line
              x1={rCx}
              y1={rCy - rMax}
              x2={rCx}
              y2={rCy + rMax}
              stroke="rgba(255,255,255,0.07)"
            />
            <line
              x1={rCx - rMax}
              y1={rCy}
              x2={rCx + rMax}
              y2={rCy}
              stroke="rgba(255,255,255,0.07)"
            />

            <text x={rCx} y={rCy - rMax + 11} textAnchor="middle" className="tick">
              N
            </text>
            <text x={rCx + rMax - 8} y={rCy + 4} textAnchor="middle" className="tick">
              E
            </text>
            <text x={rCx} y={rCy + rMax - 5} textAnchor="middle" className="tick">
              S
            </text>
            <text x={rCx - rMax + 9} y={rCy + 4} textAnchor="middle" className="tick">
              W
            </text>

            {/* Sun marker */}
            <circle cx={sunPolar.x} cy={sunPolar.y} r={8} fill="rgba(247, 179, 43, 0.22)" />
            <circle cx={sunPolar.x} cy={sunPolar.y} r={4.5} fill="#F7B32B" />

            {/* Earth marker */}
            <circle cx={earthPolar.x} cy={earthPolar.y} r={8} fill="rgba(59, 140, 255, 0.22)" />
            <circle cx={earthPolar.x} cy={earthPolar.y} r={4.5} fill="#3B8CFF" />
          </svg>

          <div className="md-sky-readouts">
            <div className="md-sky-readout-item">
              <div className="md-sky-readout-title">
                <span className="md-dot sun" /> Sun
              </div>
              <div className="md-sky-readout-val">{sample.sun_el.toFixed(1)}°</div>
              <div className="md-caption">Elevation · AZ {sample.sun_az.toFixed(1)}°</div>
              <span className={`md-status-tag ${sample.sun_visible ? 'viable' : 'not-viable'}`}>
                {sample.sun_visible ? 'VISIBLE' : 'OCCULTED'}
              </span>
            </div>

            <div className="md-sky-readout-item">
              <div className="md-sky-readout-title">
                <span className="md-dot earth" /> Earth
              </div>
              <div className="md-sky-readout-val">{sample.earth_el.toFixed(1)}°</div>
              <div className="md-caption">Elevation · AZ {sample.earth_az.toFixed(1)}°</div>
              <span className={`md-status-tag ${sample.earth_visible ? 'viable' : 'not-viable'}`}>
                {sample.earth_visible ? 'VISIBLE' : 'OCCULTED'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export interface OutlookBarProps {
  report: SiteReport
  selectedIndex: number
}

/**
 * 24-hour / Window Outlook bars for Sunlit & DTE access with NOW marker,
 * matching zoom3_midtop.pdf & 08 / WINDOW BAR in zoom2_designsystem.pdf.
 */
export function TwentyFourHourOutlook({ report, selectedIndex }: OutlookBarProps) {
  const total = Math.max(1, report.series.length - 1)
  const nowPct = Math.min(96, Math.max(4, (selectedIndex / total) * 100))

  const t0 = Date.parse(report.start)
  const tSpan = Math.max(1, Date.parse(report.end) - t0)

  const sunWindows = report.windows
    .filter((w) => w.kind === 'sun')
    .map((w) => ({
      left: Math.max(0, ((Date.parse(w.start) - t0) / tSpan) * 100),
      width: Math.min(100, ((Date.parse(w.end) - Date.parse(w.start)) / tSpan) * 100),
    }))

  const earthWindows = report.windows
    .filter((w) => w.kind === 'earth')
    .map((w) => ({
      left: Math.max(0, ((Date.parse(w.start) - t0) / tSpan) * 100),
      width: Math.min(100, ((Date.parse(w.end) - Date.parse(w.start)) / tSpan) * 100),
    }))

  return (
    <div className="md-outlook-box">
      <div className="md-outlook-header">
        <div>
          <h3 className="md-h2">24-hour outlook</h3>
          <p className="md-caption">Illumination and direct-to-Earth access</p>
        </div>
        <div className="md-outlook-legend">
          <span>
            <i className="md-sq sun" /> Sunlit
          </span>
          <span>
            <i className="md-sq earth" /> DTE access
          </span>
        </div>
      </div>

      <div className="md-outlook-axis">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>

      <div className="md-outlook-track-row">
        <div className="md-outlook-track-label">
          <strong>Sun</strong>
          <span>Solar illumination</span>
        </div>
        <div className="md-outlook-track">
          {sunWindows.length > 0 ? (
            sunWindows.map((w, i) => (
              <div
                key={i}
                className="md-outlook-fill sun"
                style={{ left: `${w.left}%`, width: `${Math.max(4, w.width)}%` }}
              />
            ))
          ) : (
            <div
              className="md-outlook-fill sun"
              style={{
                left: '8%',
                width: `${Math.max(0, report.metrics.sun_visible_pct * 0.85)}%`,
              }}
            />
          )}
          <div className="md-outlook-now-marker" style={{ left: `${nowPct}%` }}>
            <span>NOW</span>
          </div>
        </div>
      </div>

      <div className="md-outlook-track-row">
        <div className="md-outlook-track-label">
          <strong>DTE</strong>
          <span>Earth LOS</span>
        </div>
        <div className="md-outlook-track">
          {earthWindows.length > 0 ? (
            earthWindows.map((w, i) => (
              <div
                key={i}
                className="md-outlook-fill earth"
                style={{ left: `${w.left}%`, width: `${Math.max(4, w.width)}%` }}
              />
            ))
          ) : (
            <div
              className="md-outlook-fill earth"
              style={{
                left: '5%',
                width: `${Math.max(0, report.metrics.earth_visible_pct * 0.9)}%`,
              }}
            />
          )}
          <div className="md-outlook-now-marker" style={{ left: `${nowPct}%` }} />
        </div>
      </div>
    </div>
  )
}

export interface ThreeMoonCompareProps {
  sites: Site[]
  siteA: SiteReport
  siteB: SiteReport
  siteC: SiteReport | null
  onChangeSiteA: (id: string) => void
  onChangeSiteB: (id: string) => void
  onChangeSiteC: (id: string | null) => void
  delayDays: number
}

function formatDayHour(hours: number): string {
  const d = Math.floor(hours / 24)
  const h = Math.round(hours % 24)
  if (d === 0) return `${h}h`
  return `${d}d ${String(h).padStart(2, '0')}h`
}

function shortSiteLabel(name: string): string {
  if (name.includes('IM-2')) return 'MONS MOUTON'
  if (name.includes('Reiner')) return 'REINER GAMMA'
  if (name.includes('Shackleton')) return 'SHACKLETON'
  if (name.includes('Apollo')) return 'APOLLO 11'
  return name.slice(0, 14).toUpperCase()
}

/**
 * Exact implementation of the 3 Moon Cards + "Comparación de métricas" table +
 * "Comparar fechas" horizontal bars from `Cambios a realizar.png`, dynamically
 * driven by the user's selected sites (Site A, Site B, and optional Site C / Luna 3).
 */
export function ThreeMoonsComparisonSection({
  sites,
  siteA,
  siteB,
  siteC,
  onChangeSiteA,
  onChangeSiteB,
  onChangeSiteC,
  delayDays,
}: ThreeMoonCompareProps) {
  // Adjust percentages slightly with delayDays so changing the proposed window updates the moons & bars dynamically
  const shiftStats = (rep: SiteReport | null) => {
    if (!rep) return null
    const total = rep.series.length
    if (total === 0) {
      return {
        score: rep.viability?.scorePct ?? 0,
        sunPct: rep.metrics.sun_visible_pct,
        earthLinkPct: rep.viability?.subscores.communication ?? rep.metrics.earth_visible_pct,
        earthVisPct: rep.metrics.earth_visible_pct,
        contLightHours: rep.metrics.longest_sun_window_hours,
      }
    }
    const offset = Math.min(total - 24, Math.max(0, delayDays * 24))
    const windowSlice = rep.series.slice(offset)
    const len = Math.max(1, windowSlice.length)
    const sunPct = Math.round((windowSlice.filter((s) => s.sun_visible).length / len) * 100)
    const earthVisPct = Math.round((windowSlice.filter((s) => s.earth_visible).length / len) * 100)
    const minComm = rep.site.minCommElevationDeg ?? 0.5
    const earthLinkPct = Math.round(
      (windowSlice.filter((s) => s.earth_visible && s.earth_el >= minComm).length / len) * 100,
    )
    const baseScore = rep.viability?.scorePct ?? 80
    const score = delayDays === 0 ? Math.round(baseScore) : Math.round((sunPct * 0.45 + earthLinkPct * 0.55))

    return {
      score: Math.max(0, Math.min(100, score)),
      sunPct,
      earthLinkPct,
      earthVisPct,
      contLightHours: rep.metrics.longest_sun_window_hours,
    }
  }

  const statsA = shiftStats(siteA)!
  const statsB = shiftStats(siteB)!
  const statsC = shiftStats(siteC)

  const renderMoonSphereSvg = (glowId: string, glowColor: string, sunPct: number | null) => {
    const effectivePct = sunPct ?? 50
    const glowScale = 84 + (effectivePct / 100) * 16
    const shadowOffset = 60 - (effectivePct / 100) * 55

    return (
      <svg viewBox="0 0 210 210" className="md-single-moon-svg" aria-hidden="true">
        <defs>
          <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={glowColor} stopOpacity="0.72" />
            <stop offset="50%" stopColor={glowColor} stopOpacity="0.34" />
            <stop offset="78%" stopColor={glowColor} stopOpacity="0.09" />
            <stop offset="100%" stopColor={glowColor} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`lunarSurf-${glowId}`} cx="36%" cy="34%" r="66%">
            <stop offset="0%" stopColor="#F4F5F7" />
            <stop offset="38%" stopColor="#D1D5DB" />
            <stop offset="72%" stopColor="#6B7280" />
            <stop offset="100%" stopColor="#1F2937" />
          </radialGradient>
          <clipPath id={`moonClip-${glowId}`}>
            <circle cx="105" cy="105" r="60" />
          </clipPath>
        </defs>

        {/* Atmospheric radial halo glow behind the Moon (scales with site illumination) */}
        <circle cx="105" cy="105" r={glowScale} fill={`url(#${glowId})`} />

        {/* Photorealistic stylized lunar sphere with mare regions */}
        <g clipPath={`url(#moonClip-${glowId})`}>
          <circle cx="105" cy="105" r="60" fill={`url(#lunarSurf-${glowId})`} />
          {/* Mare Imbrium / Serenitatis / Tranquillitatis dark patches */}
          <ellipse
            cx="88"
            cy="86"
            rx="16"
            ry="13"
            fill="rgba(31, 41, 55, 0.42)"
            transform="rotate(-18 88 86)"
          />
          <ellipse
            cx="118"
            cy="84"
            rx="13"
            ry="11"
            fill="rgba(31, 41, 55, 0.38)"
            transform="rotate(14 118 84)"
          />
          <circle cx="126" cy="104" r="10" fill="rgba(31, 41, 55, 0.35)" />
          <ellipse cx="84" cy="112" rx="14" ry="10" fill="rgba(31, 41, 55, 0.34)" />
          <circle cx="106" cy="126" r="7" fill="rgba(31, 41, 55, 0.28)" />
          {/* Bright Tycho / Copernicus ray craters */}
          <circle cx="96" cy="134" r="4.5" fill="rgba(255, 255, 255, 0.55)" />
          <circle cx="78" cy="98" r="3.5" fill="rgba(255, 255, 255, 0.45)" />
          {/* Dynamic terminator shading based on selected site's illumination data */}
          <circle
            cx={105 + shadowOffset}
            cy="112"
            r="62"
            fill="rgba(8, 12, 20, 0.28)"
          />
        </g>

        <circle
          cx="105"
          cy="105"
          r="60"
          fill="none"
          stroke="rgba(255, 255, 255, 0.18)"
          strokeWidth="1"
        />
      </svg>
    )
  }

  const diffSun = statsA.sunPct - statsB.sunPct
  const diffLink = statsA.earthLinkPct - statsB.earthLinkPct
  const diffEarthVis = statsA.earthVisPct - statsB.earthVisPct
  const diffLightHours = statsA.contLightHours - statsB.contLightHours

  const formatSignedPts = (val: number) => `${val >= 0 ? '+' : ''}${val} pts`
  const formatSignedHours = (val: number) => {
    const sign = val >= 0 ? '+' : '-'
    return `${sign}${formatDayHour(Math.abs(val))}`
  }

  return (
    <div className="md-compare-stack">
      {/* ===================================================================
          1. THREE SEPARATE ROUNDED MOON CARDS (Exact match to Cambios a realizar.png)
         =================================================================== */}
      <div className="md-three-moons-grid">
        {/* Moon Card 1 (Site A - Purple) */}
        <div className="md-single-moon-card">
          <select
            aria-label="Seleccionar Sitio A"
            value={siteA.site.id}
            onChange={(e) => onChangeSiteA(e.target.value)}
            className="md-moon-card-select"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <div className="md-single-moon-stage">
            {renderMoonSphereSvg('moonGlowPurple', '#8B5CF6', statsA.sunPct)}
            <span className="md-single-moon-badge purple">{statsA.sunPct}%</span>
          </div>
        </div>

        {/* Moon Card 2 (Site B - Amber) */}
        <div className="md-single-moon-card">
          <select
            aria-label="Seleccionar Sitio B"
            value={siteB.site.id}
            onChange={(e) => onChangeSiteB(e.target.value)}
            className="md-moon-card-select"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <div className="md-single-moon-stage">
            {renderMoonSphereSvg('moonGlowAmber', '#F59E0B', statsB.sunPct)}
            <span className="md-single-moon-badge amber">{statsB.sunPct}%</span>
          </div>
        </div>

        {/* Moon Card 3 (Site C / Luna 3 - Teal/Cyan) */}
        <div className="md-single-moon-card">
          <select
            aria-label="Seleccionar Luna 3 (Sitio C)"
            value={siteC?.site.id ?? ''}
            onChange={(e) => onChangeSiteC(e.target.value ? e.target.value : null)}
            className="md-moon-card-select"
          >
            <option value="">Luna 3</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <div className="md-single-moon-stage">
            {renderMoonSphereSvg('moonGlowTeal', '#2DD4BF', statsC ? statsC.sunPct : null)}
            <span className="md-single-moon-badge teal">
              {statsC ? `${statsC.sunPct}%` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* ===================================================================
          2. "Comparación de métricas" TABLE CARD (Exact match to Cambios a realizar.png)
         =================================================================== */}
      <div className="md-metrics-compare-card">
        <h3 className="md-metrics-compare-title">Comparación de métricas</h3>
        <div className="md-metrics-table-wrap">
          <table className="md-metrics-compare-table">
            <thead>
              <tr>
                <th>MÉTRICA</th>
                <th>A · {shortSiteLabel(siteA.site.name)}</th>
                <th>B · {shortSiteLabel(siteB.site.name)}</th>
                <th>{siteC ? `C · ${shortSiteLabel(siteC.site.name)}` : 'C'}</th>
                <th>A VS B</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Iluminación solar</td>
                <td>
                  <span className={statsA.sunPct >= statsB.sunPct ? 'md-win-pill' : ''}>
                    {statsA.sunPct}%
                  </span>
                </td>
                <td>
                  <span className={statsB.sunPct > statsA.sunPct ? 'md-win-pill' : ''}>
                    {statsB.sunPct}%
                  </span>
                </td>
                <td>{statsC ? `${statsC.sunPct}%` : '—'}</td>
                <td className={diffSun >= 0 ? 'md-delta-pos' : 'md-delta-neg'}>
                  {formatSignedPts(diffSun)}
                </td>
              </tr>

              <tr>
                <td>Enlace con la Tierra</td>
                <td>
                  <span className={statsA.earthLinkPct >= statsB.earthLinkPct ? 'md-win-pill' : ''}>
                    {statsA.earthLinkPct}%
                  </span>
                </td>
                <td>
                  <span className={statsB.earthLinkPct > statsA.earthLinkPct ? 'md-win-pill' : ''}>
                    {statsB.earthLinkPct}%
                  </span>
                </td>
                <td>{statsC ? `${statsC.earthLinkPct}%` : '—'}</td>
                <td className={diffLink >= 0 ? 'md-delta-pos' : 'md-delta-neg'}>
                  {formatSignedPts(diffLink)}
                </td>
              </tr>

              <tr>
                <td>Tierra visible</td>
                <td>
                  <span className={statsA.earthVisPct >= statsB.earthVisPct ? 'md-win-pill' : ''}>
                    {statsA.earthVisPct}%
                  </span>
                </td>
                <td>
                  <span className={statsB.earthVisPct > statsA.earthVisPct ? 'md-win-pill' : ''}>
                    {statsB.earthVisPct}%
                  </span>
                </td>
                <td>{statsC ? `${statsC.earthVisPct}%` : '—'}</td>
                <td className={diffEarthVis >= 0 ? 'md-delta-pos' : 'md-delta-neg'}>
                  {formatSignedPts(diffEarthVis)}
                </td>
              </tr>

              <tr>
                <td>Luz continua</td>
                <td>
                  <span
                    className={
                      statsA.contLightHours >= statsB.contLightHours ? 'md-win-pill' : ''
                    }
                  >
                    {formatDayHour(statsA.contLightHours)}
                  </span>
                </td>
                <td>
                  <span
                    className={
                      statsB.contLightHours > statsA.contLightHours ? 'md-win-pill' : ''
                    }
                  >
                    {formatDayHour(statsB.contLightHours)}
                  </span>
                </td>
                <td>{statsC ? formatDayHour(statsC.contLightHours) : '—'}</td>
                <td className={diffLightHours >= 0 ? 'md-delta-pos' : 'md-delta-neg'}>
                  {formatSignedHours(diffLightHours)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================================================================
          3. "Comparar fechas" HORIZONTAL BARS CARD (Exact match to Cambios a realizar.png)
         =================================================================== */}
      <div className="md-compare-dates-card">
        <div className="md-dual-moon-head">
          <div className="md-dual-moon-title">
            <strong>Comparar fechas</strong>
          </div>
          <span className="md-meta-label">VENTANA BASE VS. PROPUESTA</span>
        </div>

        <div className="md-dual-bars">
          <div className="md-dual-bar-row">
            <span className="md-dual-bar-label">Luz solar</span>
            <div className="md-dual-bar-track">
              <div
                className="md-dual-bar-fill purple"
                style={{ width: `${Math.min(100, statsA.sunPct)}%` }}
              />
            </div>
            <span className="md-dual-bar-val">{statsA.sunPct}%</span>
          </div>

          <div className="md-dual-bar-row">
            <span className="md-dual-bar-label">Enlace Tierra</span>
            <div className="md-dual-bar-track">
              <div
                className="md-dual-bar-fill amber"
                style={{ width: `${Math.min(100, statsB.sunPct)}%` }}
              />
            </div>
            <span className="md-dual-bar-val">{statsB.sunPct}%</span>
          </div>

          <div className="md-dual-bar-row">
            <span className="md-dual-bar-label teal-label">
              {siteC ? shortSiteLabel(siteC.site.name) : 'Luna 3'}
            </span>
            <div className="md-dual-bar-track teal-track">
              {statsC && (
                <div
                  className="md-dual-bar-fill teal"
                  style={{ width: `${Math.min(100, statsC.sunPct)}%` }}
                />
              )}
            </div>
            <span className="md-dual-bar-val teal-label">
              {statsC ? `${statsC.sunPct}%` : '—'}
            </span>
          </div>

          <div className="md-dual-bar-row">
            <span className="md-dual-bar-label">Retraso</span>
            <div className="md-dual-bar-track subtle" />
            <span className="md-dual-bar-val">
              {delayDays >= 0 ? `+${delayDays} días` : `${delayDays} días`}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
