import type { Sample, SiteReport } from '../ephemeris/types.ts'

export interface OrbitalPositionProps {
  sample: Sample
  siteName: string
}

/**
 * Cenital Orbital Position diagram ("GEOMETRÍA LOCAL · Posición orbital · VISTA CENITAL")
 * inspired 99.9% by zoom6_navegador_moon.pdf in Diseños.pdf.
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
            <stop offset="0%" stopColor="#E5E7EB" />
            <stop offset="45%" stopColor="#9CA3AF" />
            <stop offset="82%" stopColor="#4B5563" />
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
          <i className="md-dot sun" /> Sol ({sample.sun_az.toFixed(0)}°)
        </span>
        <span>
          <i className="md-dot earth" /> Tierra ({sample.earth_az.toFixed(0)}°)
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
 * inspired 99.9% by zoom8_navigator_sky.pdf in Diseños.pdf.
 */
export function LocalHorizonAndSkyRow({ report, sample }: LocalHorizonProps) {
  const W = 620
  const H = 220
  const PAD = { l: 38, r: 24, t: 20, b: 30 }

  // Build 360-deg terrain mask curve (from report.horizon.profile or realistic lunar ridge harmonic)
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

  // Sky radar polar coordinates (center 95, 95, radius 72)
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

  // Compute Sun and Earth active intervals as percentages along the timeline
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

export interface DualMoonCompareProps {
  leftTitle: string
  leftScore: number
  leftSunPct: number
  leftEarthPct: number
  rightTitle: string
  rightScore: number
  rightSunPct: number
  rightEarthPct: number
  delayDays: number
}

/**
 * Dual Moon Globe comparison panel ("Comparar fechas · VENTANA BASE VS. PROPUESTA")
 * inspired 99.9% by zoom4_topright.pdf in Diseños.pdf.
 */
export function DualMoonComparisonCard({
  leftTitle,
  leftScore,
  leftSunPct,
  leftEarthPct,
  rightTitle,
  rightScore,
  rightSunPct,
  rightEarthPct,
  delayDays,
}: DualMoonCompareProps) {
  return (
    <div className="md-dual-moon-card">
      <div className="md-dual-moon-head">
        <div className="md-dual-moon-title">
          <span>⇄</span>
          <strong>Comparar escenarios y fechas</strong>
        </div>
        <span className="md-meta-label">VENTANA BASE VS. PROPUESTA</span>
      </div>

      <div className="md-dual-moon-globes">
        {/* Left Moon */}
        <div className="md-moon-column">
          <div className="md-moon-column-name">{leftTitle}</div>
          <div className="md-moon-sphere-wrap">
            <svg viewBox="0 0 180 180" className="md-moon-sphere-svg">
              <circle
                cx="90"
                cy="90"
                r="72"
                fill="none"
                stroke="rgba(139, 92, 246, 0.22)"
                strokeWidth="5"
              />
              <circle
                cx="90"
                cy="90"
                r="72"
                fill="none"
                stroke="#8B5CF6"
                strokeWidth="5"
                strokeDasharray={`${(leftScore / 100) * 452} 452`}
                transform="rotate(-90 90 90)"
                strokeLinecap="round"
              />
              <circle cx="90" cy="90" r="52" fill="url(#moonSphereGrad)" />
              <circle cx="76" cy="78" r="12" fill="rgba(31,41,55,0.35)" />
              <circle cx="102" cy="74" r="9" fill="rgba(31,41,55,0.32)" />
              <circle cx="74" cy="102" r="8" fill="rgba(31,41,55,0.28)" />
            </svg>
            <span className="md-moon-score-pill purple">{leftScore}%</span>
          </div>
          <div className="md-caption">
            Sol {leftSunPct.toFixed(1)}% · Tierra {leftEarthPct.toFixed(1)}%
          </div>
        </div>

        {/* Right Moon */}
        <div className="md-moon-column">
          <div className="md-moon-column-name">{rightTitle}</div>
          <div className="md-moon-sphere-wrap">
            <svg viewBox="0 0 180 180" className="md-moon-sphere-svg">
              <circle
                cx="90"
                cy="90"
                r="72"
                fill="none"
                stroke="rgba(247, 179, 43, 0.22)"
                strokeWidth="5"
              />
              <circle
                cx="90"
                cy="90"
                r="72"
                fill="none"
                stroke="#F7B32B"
                strokeWidth="5"
                strokeDasharray={`${(rightScore / 100) * 452} 452`}
                transform="rotate(-90 90 90)"
                strokeLinecap="round"
              />
              <circle cx="90" cy="90" r="52" fill="url(#moonSphereGrad)" />
              <circle cx="76" cy="78" r="12" fill="rgba(31,41,55,0.35)" />
              <circle cx="102" cy="74" r="9" fill="rgba(31,41,55,0.32)" />
              <circle cx="74" cy="102" r="8" fill="rgba(31,41,55,0.28)" />
            </svg>
            <span className="md-moon-score-pill amber">{rightScore}%</span>
          </div>
          <div className="md-caption">
            Sol {rightSunPct.toFixed(1)}% · Tierra {rightEarthPct.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Bottom Comparison Bars */}
      <div className="md-dual-bars">
        <div className="md-dual-bar-row">
          <span className="md-dual-bar-label">Luz solar</span>
          <div className="md-dual-bar-track">
            <div
              className="md-dual-bar-fill purple"
              style={{ width: `${Math.min(100, leftSunPct)}%` }}
            />
          </div>
          <span className="md-dual-bar-val">{leftSunPct.toFixed(0)}%</span>
        </div>

        <div className="md-dual-bar-row">
          <span className="md-dual-bar-label">Enlace Tierra</span>
          <div className="md-dual-bar-track">
            <div
              className="md-dual-bar-fill amber"
              style={{ width: `${Math.min(100, rightEarthPct)}%` }}
            />
          </div>
          <span className="md-dual-bar-val">{rightEarthPct.toFixed(0)}%</span>
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
  )
}
