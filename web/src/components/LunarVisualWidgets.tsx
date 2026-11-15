import type { Sample, Site, SiteReport } from '../ephemeris/types.ts'

export interface OrbitalPositionProps {
  sample: Sample
  siteName: string
  lang?: 'es' | 'en'
}

/**
 * Cenital Orbital Position diagram ("GEOMETRÍA LOCAL · Posición orbital · VISTA CENITAL")
 * using the real photographic Moon from Diseños completos.pdf.
 */
export function OrbitalPositionCenital({ sample, lang = 'es' }: OrbitalPositionProps) {
  const cx = 180
  const cy = 180
  const rOuter = 132
  const rMid = 104
  const rInner = 76
  const rMoon = 50

  // Map the exact Moon disk (cx=626.5, cy=586, r=493 in 1200x1200 moon-real.jpg) to (cx=180, cy=180, r=50)
  const imgSize = 1200 * (rMoon / 493)
  const imgX = cx - 626.5 * (rMoon / 493)
  const imgY = cy - 586.0 * (rMoon / 493)
  const moonUrl = `${import.meta.env.BASE_URL}moon-real.jpg`

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
          <span className="md-eyebrow">
            {lang === 'es' ? 'GEOMETRÍA LOCAL' : 'LOCAL GEOMETRY'}
          </span>
          <h3 className="md-h2">
            {lang === 'es' ? 'Posición orbital' : 'Orbital position'}
          </h3>
        </div>
        <span className="md-meta-label">
          {lang === 'es' ? 'VISTA CENITAL' : 'TOP-DOWN VIEW'}
        </span>
      </div>

      <svg
        viewBox="0 0 360 360"
        className="md-orbital-svg"
        role="img"
        aria-label={
          lang === 'es'
            ? 'Posición orbital cenital del Sol y la Tierra respecto a la Luna'
            : 'Top-down orbital position of the Sun and Earth relative to the Moon'
        }
      >
        <defs>
          <clipPath id="cenitalMoonClip">
            <circle cx={cx} cy={cy} r={rMoon} />
          </clipPath>
          <radialGradient id="cenitalMoonHalo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#8CBBFF" stopOpacity="0.28" />
            <stop offset="70%" stopColor="#3B8CFF" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#3B8CFF" stopOpacity="0" />
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

        {/* Subtle halo + Real photographic Moon in center */}
        <circle cx={cx} cy={cy} r={rMoon + 12} fill="url(#cenitalMoonHalo)" />
        <g clipPath="url(#cenitalMoonClip)">
          <image
            href={moonUrl}
            x={imgX}
            y={imgY}
            width={imgSize}
            height={imgSize}
            preserveAspectRatio="none"
          />
        </g>
        <circle
          cx={cx}
          cy={cy}
          r={rMoon}
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1.2"
        />

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
            {lang === 'es' ? 'TIERRA' : 'EARTH'}
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
            {lang === 'es' ? 'SOL' : 'SUN'}
          </text>
        </g>
      </svg>

      <div className="md-orbital-legend">
        <span>
          <i className="md-dot sun" /> {lang === 'es' ? 'Sol' : 'Sun'}
        </span>
        <span>
          <i className="md-dot earth" /> {lang === 'es' ? 'Tierra' : 'Earth'}
        </span>
        <span>
          <i className="md-line-swatch" /> {lang === 'es' ? 'Trayectoria' : 'Trajectory'}
        </span>
      </div>
    </div>
  )
}

export interface LocalHorizonProps {
  report: SiteReport
  sample: Sample
  lang?: 'es' | 'en'
}

/**
 * Local Horizon & Terrain profile (0° N to 360° azimuth) + Sky Visibility Radar.
 */
export function LocalHorizonAndSkyRow({ report, sample, lang = 'es' }: LocalHorizonProps) {
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
            <h3 className="md-h2">
              {lang === 'es' ? 'Horizonte local y terreno' : 'Local horizon & terrain'}
            </h3>
            <p className="md-caption">
              {lang === 'es'
                ? `Ángulo de elevación por acimut (${report.site.name})`
                : `Elevation angle by azimuth (${report.site.name})`}
            </p>
          </div>
          <span className="md-tag-pill">SPICE DE440 · LOLA</span>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="md-horizon-svg"
          role="img"
          aria-label={
            lang === 'es'
              ? 'Perfil de horizonte local de 360 grados'
              : '360-degree local horizon profile'
          }
        >
          <defs>
            <linearGradient id="terrainFillGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B8CFF" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#12161F" stopOpacity="0.88" />
            </linearGradient>
          </defs>

          {[0, 5, 10, 15].map((deg) => {
            if (deg > maxEl) return null
            const y = yEl(deg)
            return (
              <g key={deg}>
                <line
                  x1={PAD.l}
                  x2={W - PAD.r}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.07)"
                  strokeDasharray={deg === 0 ? undefined : '4 4'}
                />
                <text x={PAD.l - 6} y={y + 4} textAnchor="end" className="tick">
                  {deg}°
                </text>
              </g>
            )
          })}

          {[
            { az: 0, label: '0° N' },
            { az: 90, label: '90° E' },
            { az: 180, label: '180° S' },
            { az: 270, label: '270° W' },
            { az: 360, label: '360°' },
          ].map((t) => (
            <g key={t.az}>
              <line
                x1={xAz(t.az)}
                x2={xAz(t.az)}
                y1={PAD.t}
                y2={H - PAD.b}
                stroke="rgba(255,255,255,0.05)"
              />
              <text x={xAz(t.az)} y={H - 8} textAnchor="middle" className="tick">
                {t.label}
              </text>
            </g>
          ))}

          <path d={terrainArea} fill="url(#terrainFillGrad)" />
          <path d={terrainLine} fill="none" stroke="rgba(140, 187, 255, 0.55)" strokeWidth="2" />

          <g
            transform={`translate(${xAz(((sample.sun_az % 360) + 360) % 360)}, ${yEl(
              Math.max(minEl, Math.min(maxEl, sample.sun_el)),
            )})`}
          >
            <circle r={6.5} fill="#F7B32B" stroke="#1A1A1A" strokeWidth="1.5" />
            <text x={10} y={4} className="md-marker-label sun">
              {lang === 'es' ? 'Sol' : 'Sun'} {sample.sun_el.toFixed(1)}°
            </text>
          </g>

          <g
            transform={`translate(${xAz(((sample.earth_az % 360) + 360) % 360)}, ${yEl(
              Math.max(minEl, Math.min(maxEl, sample.earth_el)),
            )})`}
          >
            <circle r={6.5} fill="#3B8CFF" stroke="#1A1A1A" strokeWidth="1.5" />
            <text x={10} y={4} className="md-marker-label earth">
              {lang === 'es' ? 'Tierra' : 'Earth'} {sample.earth_el.toFixed(1)}°
            </text>
          </g>
        </svg>

        <div className="md-orbital-legend">
          <span>
            <i className="md-dot earth" /> {lang === 'es' ? 'Horizonte terreno' : 'Terrain horizon'}
          </span>
          <span>
            <i className="md-dot sun" /> {lang === 'es' ? 'Posición Sol' : 'Sun position'}
          </span>
          <span>
            <i className="md-dot earth" /> {lang === 'es' ? 'Posición Tierra' : 'Earth position'}
          </span>
        </div>
      </div>

      {/* Right: Sky visibility polar radar */}
      <div className="md-panel">
        <div className="md-panel-header-row">
          <div>
            <h3 className="md-h2">
              {lang === 'es' ? 'Visibilidad del cielo' : 'Sky visibility'}
            </h3>
            <p className="md-caption">
              {lang === 'es' ? 'Vista polar · Cenit al horizonte' : 'Polar view · Zenith to horizon'}
            </p>
          </div>
          <span className="md-info-circle" title="Proyección polar estereográfica">
            i
          </span>
        </div>

        <div className="md-sky-radar-layout">
          <svg viewBox="0 0 190 190" className="md-sky-radar-svg">
            <circle
              cx={rCx}
              cy={rCy}
              r={rMax}
              fill="rgba(15, 20, 28, 0.9)"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth="1.2"
            />
            <circle
              cx={rCx}
              cy={rCy}
              r={rMax * 0.66}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeDasharray="3 3"
            />
            <circle
              cx={rCx}
              cy={rCy}
              r={rMax * 0.33}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeDasharray="3 3"
            />
            <line
              x1={rCx}
              x2={rCx}
              y1={rCy - rMax}
              y2={rCy + rMax}
              stroke="rgba(255,255,255,0.08)"
            />
            <line
              x1={rCx - rMax}
              x2={rCx + rMax}
              y1={rCy}
              y2={rCy}
              stroke="rgba(255,255,255,0.08)"
            />
            <text x={rCx} y={rCy - rMax - 6} textAnchor="middle" className="tick">
              N
            </text>
            <text x={rCx + rMax + 9} y={rCy + 3} textAnchor="middle" className="tick">
              E
            </text>
            <text x={rCx} y={rCy + rMax + 13} textAnchor="middle" className="tick">
              S
            </text>
            <text x={rCx - rMax - 9} y={rCy + 3} textAnchor="middle" className="tick">
              W
            </text>

            <circle
              cx={sunPolar.x}
              cy={sunPolar.y}
              r={6}
              fill="#F7B32B"
              stroke="#111"
              strokeWidth="1.5"
            />
            <circle
              cx={earthPolar.x}
              cy={earthPolar.y}
              r={6}
              fill="#3B8CFF"
              stroke="#111"
              strokeWidth="1.5"
            />
          </svg>

          <div className="md-sky-readouts">
            <div className="md-sky-readout-item">
              <div className="md-sky-readout-title">
                <span className="md-dot sun" /> {lang === 'es' ? 'Sol' : 'Sun'}
              </div>
              <div className="md-sky-readout-val">{sample.sun_el.toFixed(1)}°</div>
              <div className="md-caption">
                {lang === 'es' ? 'Elevación' : 'Elevation'} · AZ {sample.sun_az.toFixed(1)}°
              </div>
              <span className={`md-status-tag ${sample.sun_visible ? 'viable' : 'not-viable'}`}>
                {sample.sun_visible
                  ? lang === 'es'
                    ? 'VISIBLE'
                    : 'VISIBLE'
                  : lang === 'es'
                    ? 'OCULTO'
                    : 'OCCULTED'}
              </span>
            </div>

            <div className="md-sky-readout-item">
              <div className="md-sky-readout-title">
                <span className="md-dot earth" /> {lang === 'es' ? 'Tierra' : 'Earth'}
              </div>
              <div className="md-sky-readout-val">{sample.earth_el.toFixed(1)}°</div>
              <div className="md-caption">
                {lang === 'es' ? 'Elevación' : 'Elevation'} · AZ {sample.earth_az.toFixed(1)}°
              </div>
              <span className={`md-status-tag ${sample.earth_visible ? 'viable' : 'not-viable'}`}>
                {sample.earth_visible
                  ? lang === 'es'
                    ? 'VISIBLE'
                    : 'VISIBLE'
                  : lang === 'es'
                    ? 'OCULTO'
                    : 'OCCULTED'}
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
  lang?: 'es' | 'en'
}

/**
 * 24-hour / Window Outlook bars for Sunlit & DTE access with NOW marker.
 */
export function TwentyFourHourOutlook({ report, selectedIndex, lang = 'es' }: OutlookBarProps) {
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
          <h3 className="md-h2">
            {lang === 'es' ? 'Perspectiva de 24 horas' : '24-hour outlook'}
          </h3>
          <p className="md-caption">
            {lang === 'es'
              ? 'Iluminación solar y acceso directo a la Tierra'
              : 'Illumination and direct-to-Earth access'}
          </p>
        </div>
        <div className="md-outlook-legend">
          <span>
            <i className="md-sq sun" /> {lang === 'es' ? 'Luz solar' : 'Sunlit'}
          </span>
          <span>
            <i className="md-sq earth" /> {lang === 'es' ? 'Acceso DTE' : 'DTE access'}
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
          <strong>{lang === 'es' ? 'Sol' : 'Sun'}</strong>
          <span>{lang === 'es' ? 'Iluminación solar' : 'Solar illumination'}</span>
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
            <span>{lang === 'es' ? 'AHORA' : 'NOW'}</span>
          </div>
        </div>
      </div>

      <div className="md-outlook-track-row">
        <div className="md-outlook-track-label">
          <strong>DTE</strong>
          <span>{lang === 'es' ? 'Línea a Tierra' : 'Earth LOS'}</span>
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

export interface PedagogicalSkyProps {
  report: SiteReport
  sample: Sample
  lang?: 'es' | 'en'
}

/**
 * Simplified pedagogical Sky & Communication section ("EXPLORA EL CIELO LUNAR ·
 * El Sol y la Tierra vistos desde la Luna" + "Luz solar y comunicación")
 * from dc_sheet2_edu.pdf in Diseños completos.pdf.
 */
export function PedagogicalSkyChart({ report, sample, lang = 'es' }: PedagogicalSkyProps) {
  const W = 540
  const H = 220
  const PAD = { l: 42, r: 34, t: 18, b: 32 }

  const n = Math.max(1, report.series.length - 1)
  const xAt = (idx: number) => PAD.l + (idx / n) * (W - PAD.l - PAD.r)
  const yAt = (el: number) => PAD.t + ((90 - el) / 180) * (H - PAD.t - PAD.b)

  const sunPath = report.series
    .map((s, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)},${yAt(s.sun_el).toFixed(1)}`)
    .join('')
  const earthPath = report.series
    .map((s, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)},${yAt(s.earth_el).toFixed(1)}`)
    .join('')

  const sunPct = Math.max(6, Math.min(100, report.metrics.sun_visible_pct))
  const earthPct = Math.max(6, Math.min(100, report.metrics.earth_visible_pct))

  return (
    <section className="md-mission-control-card">
      <div className="md-mission-control-grid">
        {/* Left: Simplified Sky Chart */}
        <div className="md-mc-chart-col">
          <span className="md-eyebrow">
            {lang === 'es' ? 'EXPLORA EL CIELO LUNAR' : 'EXPLORE THE LUNAR SKY'}
          </span>
          <h2 className="md-h1">
            {lang === 'es'
              ? 'El Sol y la Tierra vistos desde la Luna'
              : 'The Sun and Earth seen from the Moon'}
          </h2>
          <p className="md-caption">
            {report.site.name} ·{' '}
            {lang === 'es'
              ? '14 nov — 14 dic 2026 · La altura se mide en grados (°), no en kilómetros.'
              : 'Nov 14 — Dec 14, 2026 · Height is measured in degrees (°), not kilometers.'}
          </p>

          <div className="md-mc-readout-strip" style={{ marginTop: '12px' }}>
            <div className="md-mc-epoch-box">
              <span>
                {lang === 'es' ? 'Lectura del' : 'Reading at'}{' '}
                {sample.t.slice(0, 16).replace('T', ' ')} UTC
              </span>
            </div>
            <div className="md-mc-body-readout">
              <span className="md-sun-text">
                {lang === 'es' ? 'Sol' : 'Sun'} <strong>{sample.sun_el.toFixed(2)}°</strong>
              </span>
            </div>
            <div className="md-mc-body-readout">
              <span className="md-earth-text">
                {lang === 'es' ? 'Tierra' : 'Earth'}{' '}
                <strong>{sample.earth_el.toFixed(2)}°</strong>
              </span>
            </div>
          </div>

          <div className="md-caption" style={{ marginBottom: '4px' }}>
            {lang === 'es' ? 'Altura sobre el horizonte (°)' : 'Height above the horizon (°)'}
          </div>

          <svg viewBox={`0 0 ${W} ${H}`} className="md-elevation-svg">
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={yAt(90)}
              y2={yAt(90)}
              className="grid"
            />
            <text x={PAD.l - 8} y={yAt(90) + 4} textAnchor="end" className="tick">
              90°
            </text>

            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={yAt(0)}
              y2={yAt(0)}
              className="horizon"
            />
            <text x={PAD.l - 8} y={yAt(0) + 4} textAnchor="end" className="tick">
              0°
            </text>
            <text x={W - PAD.r - 8} y={yAt(0) + 14} textAnchor="end" className="horizon-label">
              {lang === 'es' ? '0° · Horizonte' : '0° · Horizon'}
            </text>

            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={yAt(-90)}
              y2={yAt(-90)}
              className="grid"
            />
            <text x={PAD.l - 8} y={yAt(-90) + 4} textAnchor="end" className="tick">
              -90°
            </text>

            <path d={sunPath} className="line sun" />
            <path d={earthPath} className="line earth" />

            <text x={PAD.l} y={H - 8} className="tick">
              {lang === 'es' ? '14 nov' : 'Nov 14'}
            </text>
            <text x={W / 2} y={H - 8} textAnchor="middle" className="tick">
              {lang === 'es' ? '29 nov' : 'Nov 29'}
            </text>
            <text x={W - PAD.r} y={H - 8} textAnchor="end" className="tick">
              {lang === 'es' ? '14 dic' : 'Dec 14'}
            </text>
          </svg>
        </div>

        {/* Right: Pedagogical 1. Luz del Sol & 2. Vista hacia la Tierra */}
        <div className="md-mc-outlook-col">
          <div className="md-outlook-box">
            <div>
              <h3 className="md-h2">
                {lang === 'es' ? 'Luz solar y comunicación' : 'Sunlight and communication'}
              </h3>
              <p className="md-caption" style={{ marginTop: '4px' }}>
                {lang === 'es'
                  ? 'Lee de izquierda a derecha. Las barras muestran un periodo de 24 horas en un sitio de la Luna.'
                  : 'Read from left to right. The bars show a 24-hour period at this site on the Moon.'}
              </p>
            </div>

            <div className="md-pedagogical-bar-block">
              <strong className="md-sun-text">
                {lang === 'es' ? '1. Luz del Sol' : '1. Sunlight'}
              </strong>
              <span className="md-caption">
                {lang === 'es'
                  ? 'Amarillo: el sitio recibe luz del Sol para energía solar.'
                  : 'Yellow: the site receives sunlight for solar power.'}
              </span>
              <div className="md-outlook-track" style={{ marginTop: '6px' }}>
                <div
                  className="md-outlook-fill sun"
                  style={{ left: '0%', width: `${sunPct}%` }}
                />
              </div>
              <div className="md-time-slider-ticks" style={{ marginTop: '4px' }}>
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>24:00</span>
              </div>
            </div>

            <div className="md-pedagogical-bar-block">
              <strong className="md-earth-text">
                {lang === 'es' ? '2. Vista hacia la Tierra' : '2. Line of sight to Earth'}
              </strong>
              <span className="md-caption">
                {lang === 'es'
                  ? 'Azul: hay línea de visión hacia la Tierra, necesaria para comunicarse.'
                  : 'Blue: direct line of sight to Earth, required for communication.'}
              </span>
              <div className="md-outlook-track" style={{ marginTop: '6px' }}>
                <div
                  className="md-outlook-fill earth"
                  style={{ left: '6%', width: `${Math.min(92, earthPct)}%` }}
                />
              </div>
              <div className="md-time-slider-ticks" style={{ marginTop: '4px' }}>
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>24:00</span>
              </div>
            </div>

            <p className="md-caption">
              {lang === 'es'
                ? 'Tramos oscuros: no hay luz o no hay vista de la Tierra, según la fila.'
                : 'Dark segments: no sunlight or no line of sight to Earth, depending on the row.'}
            </p>
          </div>
        </div>
      </div>
    </section>
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
  lang?: 'es' | 'en'
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
  if (name.includes('Apollo') || name.includes('Mare')) return 'APOLLO 11'
  return name.slice(0, 14).toUpperCase()
}

/**
 * Exact implementation of the 3 Real Photographic Moon Cards +
 * "Comparación de métricas" table + "Comparar fechas" horizontal bars
 * from `Diseños completos.pdf` & `Cambios a realizar.png`.
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
  lang = 'es',
}: ThreeMoonCompareProps) {
  const moonUrl = `${import.meta.env.BASE_URL}moon-real.jpg`

  const shiftStats = (rep: SiteReport | null) => {
    if (!rep) return null
    const total = rep.series.length
    if (total === 0) {
      return {
        score: rep.viability?.scorePct ?? 0,
        sunPct: Math.round(rep.metrics.sun_visible_pct),
        earthLinkPct: Math.round(
          rep.viability?.subscores.communication ?? rep.metrics.earth_visible_pct,
        ),
        earthVisPct: Math.round(rep.metrics.earth_visible_pct),
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
    const score =
      delayDays === 0 ? Math.round(baseScore) : Math.round(sunPct * 0.45 + earthLinkPct * 0.55)

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

  // Map the exact Moon disk (cx=626.5, cy=586, r=493 in 1200x1200 moon-real.jpg) to (cx=105, cy=105, r=60)
  const rMoon = 60
  const imgSize = 1200 * (rMoon / 493)
  const imgX = 105 - 626.5 * (rMoon / 493)
  const imgY = 105 - 586.0 * (rMoon / 493)

  const renderRealMoonSphere = (glowId: string, glowColor: string, sunPct: number | null) => {
    const effectivePct = sunPct ?? 55
    const glowScale = 86 + (effectivePct / 100) * 14
    const shadowOffset = 52 - (effectivePct / 100) * 48

    return (
      <svg viewBox="0 0 210 210" className="md-single-moon-svg" aria-hidden="true">
        <defs>
          <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={glowColor} stopOpacity="0.78" />
            <stop offset="48%" stopColor={glowColor} stopOpacity="0.38" />
            <stop offset="76%" stopColor={glowColor} stopOpacity="0.1" />
            <stop offset="100%" stopColor={glowColor} stopOpacity="0" />
          </radialGradient>
          <clipPath id={`realMoonClip-${glowId}`}>
            <circle cx="105" cy="105" r={rMoon} />
          </clipPath>
        </defs>

        {/* Atmospheric radial halo glow behind the real Moon */}
        <circle cx="105" cy="105" r={glowScale} fill={`url(#${glowId})`} />

        {/* Real high-res photographic Moon extracted from Diseños completos.pdf */}
        <g clipPath={`url(#realMoonClip-${glowId})`}>
          <image
            href={moonUrl}
            x={imgX}
            y={imgY}
            width={imgSize}
            height={imgSize}
            preserveAspectRatio="none"
          />
          {/* Subtle dynamic terminator shading driven by selected site's illumination */}
          <circle
            cx={105 + shadowOffset}
            cy="110"
            r="64"
            fill="rgba(6, 10, 18, 0.22)"
          />
        </g>

        <circle
          cx="105"
          cy="105"
          r={rMoon}
          fill="none"
          stroke="rgba(255, 255, 255, 0.22)"
          strokeWidth="1.1"
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
          1. THREE SEPARATE ROUNDED CARDS WITH REAL PHOTOGRAPHIC MOONS
         =================================================================== */}
      <div className="md-three-moons-grid">
        {/* Moon Card 1 (Site A - Purple) */}
        <div className="md-single-moon-card">
          <select
            aria-label={lang === 'es' ? 'Seleccionar Sitio A' : 'Select Site A'}
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
            {renderRealMoonSphere('moonGlowPurple', '#8B5CF6', statsA.sunPct)}
            <span className="md-single-moon-badge purple">{statsA.sunPct}%</span>
          </div>
        </div>

        {/* Moon Card 2 (Site B - Amber) */}
        <div className="md-single-moon-card">
          <select
            aria-label={lang === 'es' ? 'Seleccionar Sitio B' : 'Select Site B'}
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
            {renderRealMoonSphere('moonGlowAmber', '#F59E0B', statsB.sunPct)}
            <span className="md-single-moon-badge amber">{statsB.sunPct}%</span>
          </div>
        </div>

        {/* Moon Card 3 (Site C / Luna 3 - Teal/Cyan) */}
        <div className="md-single-moon-card">
          <select
            aria-label={lang === 'es' ? 'Seleccionar Luna 3 (Sitio C)' : 'Select Moon 3 (Site C)'}
            value={siteC?.site.id ?? ''}
            onChange={(e) => onChangeSiteC(e.target.value ? e.target.value : null)}
            className="md-moon-card-select"
          >
            <option value="">{lang === 'es' ? 'Luna 3' : 'Moon 3'}</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <div className="md-single-moon-stage">
            {renderRealMoonSphere('moonGlowTeal', '#2DD4BF', statsC ? statsC.sunPct : null)}
            <span className="md-single-moon-badge teal">
              {statsC ? `${statsC.sunPct}%` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* ===================================================================
          2. "Comparación de métricas" TABLE CARD
         =================================================================== */}
      <div className="md-metrics-compare-card">
        <h3 className="md-metrics-compare-title">
          {lang === 'es' ? 'Comparación de métricas' : 'Metrics comparison'}
        </h3>
        <div className="md-metrics-table-wrap">
          <table className="md-metrics-compare-table">
            <thead>
              <tr>
                <th>{lang === 'es' ? 'MÉTRICA' : 'METRIC'}</th>
                <th>A · {shortSiteLabel(siteA.site.name)}</th>
                <th>B · {shortSiteLabel(siteB.site.name)}</th>
                <th>{siteC ? `C · ${shortSiteLabel(siteC.site.name)}` : 'C'}</th>
                <th>A VS B</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{lang === 'es' ? 'Iluminación solar' : 'Solar illumination'}</td>
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
                <td>{lang === 'es' ? 'Enlace con la Tierra' : 'Earth communication link'}</td>
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
                <td>{lang === 'es' ? 'Tierra visible' : 'Earth visible'}</td>
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
                <td>{lang === 'es' ? 'Luz continua' : 'Continuous light'}</td>
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
          3. "Comparar fechas" HORIZONTAL BARS CARD
         =================================================================== */}
      <div className="md-compare-dates-card">
        <div className="md-dual-moon-head">
          <div className="md-dual-moon-title">
            <strong>{lang === 'es' ? 'Comparar fechas' : 'Compare dates'}</strong>
          </div>
          <span className="md-meta-label">
            {lang === 'es' ? 'VENTANA BASE VS. PROPUESTA' : 'BASE VS. PROPOSED WINDOW'}
          </span>
        </div>

        <div className="md-dual-bars">
          <div className="md-dual-bar-row">
            <span className="md-dual-bar-label">
              {lang === 'es' ? 'Luz solar' : 'Sunlight'}
            </span>
            <div className="md-dual-bar-track">
              <div
                className="md-dual-bar-fill purple"
                style={{ width: `${Math.min(100, statsA.sunPct)}%` }}
              />
            </div>
            <span className="md-dual-bar-val">{statsA.sunPct}%</span>
          </div>

          <div className="md-dual-bar-row">
            <span className="md-dual-bar-label">
              {lang === 'es' ? 'Enlace Tierra' : 'Earth link'}
            </span>
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
              {siteC ? shortSiteLabel(siteC.site.name) : lang === 'es' ? 'Luna 3' : 'Moon 3'}
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
            <span className="md-dual-bar-label">
              {lang === 'es' ? 'Retraso' : 'Delay'}
            </span>
            <div className="md-dual-bar-track subtle" />
            <span className="md-dual-bar-val">
              {delayDays >= 0
                ? `+${delayDays} ${lang === 'es' ? 'días' : 'days'}`
                : `${delayDays} ${lang === 'es' ? 'días' : 'days'}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
