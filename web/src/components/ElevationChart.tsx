import type { SiteReport } from '../ephemeris/types.ts'

const W = 880
const H = 290
const PAD = { l: 46, r: 64, t: 24, b: 34 }

export interface ElevationChartProps {
  report: SiteReport
  selectedIndex?: number
  onSelectIndex?: (index: number) => void
}

/**
 * Elevation of the Sun and the Earth over the whole report, matching the
 * ORYSEL / MOON DIAL design system in Diseños.pdf (with area gradients,
 * link threshold line, horizon 0° line, and interactive epoch marker).
 */
export function ElevationChart({ report, selectedIndex, onSelectIndex }: ElevationChartProps) {
  const { series, windows, horizon, site } = report
  const t0 = Date.parse(report.start)
  const t1 = Date.parse(report.end)
  const terrainMaskDeg =
    horizon.profile && horizon.profile.length > 0
      ? horizon.profile.reduce((a, b) => a + b, 0) / horizon.profile.length
      : 0
  const commThresholdDeg = Math.max(terrainMaskDeg, site.minCommElevationDeg ?? 0, 2)

  const els = series.flatMap((s) => [s.sun_el, s.earth_el, commThresholdDeg, 0])
  const lo = Math.floor(Math.min(...els, -4) / 5) * 5
  const hi = Math.ceil(Math.max(...els, 12) / 5) * 5
  const spanDeg = Math.max(10, hi - lo)
  const stepTick = spanDeg > 90 ? 30 : spanDeg > 40 ? 15 : spanDeg > 18 ? 5 : 2

  const x = (iso: string | number) =>
    PAD.l + (((typeof iso === 'number' ? iso : Date.parse(iso)) - t0) / (t1 - t0)) * (W - PAD.l - PAD.r)
  const y = (el: number) => PAD.t + ((hi - el) / (hi - lo)) * (H - PAD.t - PAD.b)

  const linePath = (key: 'sun_el' | 'earth_el') =>
    series.map((s, i) => `${i ? 'L' : 'M'}${x(s.t).toFixed(1)},${y(s[key]).toFixed(1)}`).join('')

  const areaPath = (key: 'sun_el' | 'earth_el') => {
    if (series.length === 0) return ''
    const firstX = x(series[0].t).toFixed(1)
    const lastX = x(series[series.length - 1].t).toFixed(1)
    const baseY = (H - PAD.b).toFixed(1)
    return `${linePath(key)}L${lastX},${baseY}L${firstX},${baseY}Z`
  }

  const days: number[] = []
  for (let t = t0; t <= t1; t += 5 * 86_400_000) days.push(t)
  const ticks: number[] = []
  for (let v = lo; v <= hi; v += stepTick) ticks.push(v)
  if (!ticks.includes(0) && lo <= 0 && hi >= 0) {
    ticks.push(0)
    ticks.sort((a, b) => a - b)
  }

  const last = series[series.length - 1]
  const activeSample =
    selectedIndex !== undefined && series[selectedIndex] ? series[selectedIndex] : series[0]

  const yZero = y(0)
  const yMask = y(commThresholdDeg)
  const yBottom = H - PAD.b

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      className="md-elevation-svg"
      aria-label="Elevación del Sol y de la Tierra sobre el horizonte en el tiempo"
      onClick={(e) => {
        if (!onSelectIndex || series.length === 0) return
        const rect = e.currentTarget.getBoundingClientRect()
        const relX = ((e.clientX - rect.left) / rect.width) * W
        const frac = Math.min(1, Math.max(0, (relX - PAD.l) / (W - PAD.l - PAD.r)))
        onSelectIndex(Math.round(frac * (series.length - 1)))
      }}
    >
      <defs>
        <linearGradient id="sunAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F7B32B" stopOpacity="0.34" />
          <stop offset="55%" stopColor="#A855F7" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#121417" stopOpacity="0.0" />
        </linearGradient>
        <linearGradient id="earthAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B8CFF" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#3B8CFF" stopOpacity="0.0" />
        </linearGradient>
      </defs>

      <text className="chart-axis-title" x={PAD.l - 6} y={14} textAnchor="start">
        Elevación (°)
      </text>

      {/* Daylight windows subtle backdrop */}
      {windows
        .filter((w) => w.kind === 'sun')
        .map((w) => (
          <rect
            key={w.start}
            className="day"
            x={x(w.start)}
            y={PAD.t}
            width={Math.max(1, x(w.end) - x(w.start))}
            height={H - PAD.t - PAD.b}
          />
        ))}

      {/* Blind-spot / Obstructed terrain danger zone */}
      {yMask < yBottom && (
        <rect
          className="blind-zone"
          x={PAD.l}
          y={Math.max(PAD.t, yMask)}
          width={W - PAD.l - PAD.r}
          height={Math.max(0, yBottom - Math.max(PAD.t, yMask))}
        />
      )}

      {ticks.map((v) => (
        <g key={v}>
          <line
            className={v === 0 ? 'horizon' : 'grid'}
            x1={PAD.l}
            x2={W - PAD.r}
            y1={y(v)}
            y2={y(v)}
          />
          <text className="tick" x={PAD.l - 8} y={y(v) + 4} textAnchor="end">
            {v}°
          </text>
        </g>
      ))}

      {/* Area fills */}
      <path d={areaPath('earth_el')} fill="url(#earthAreaGrad)" />
      <path d={areaPath('sun_el')} fill="url(#sunAreaGrad)" />

      {/* Link threshold line */}
      <g>
        <line
          className="mask-line"
          x1={PAD.l}
          x2={W - PAD.r}
          y1={yMask}
          y2={yMask}
        />
        <text className="mask-label" x={PAD.l + 8} y={Math.max(PAD.t + 12, yMask - 5)}>
          Umbral de enlace · {commThresholdDeg.toFixed(0)}°
        </text>
      </g>

      {/* Horizon 0 deg label on right */}
      {lo <= 0 && hi >= 0 && (
        <text className="horizon-label" x={W - PAD.r - 6} y={yZero - 5} textAnchor="end">
          Horizonte · 0°
        </text>
      )}

      {days.map((t) => (
        <text key={t} className="tick" x={x(t)} y={H - 10} textAnchor="middle">
          {new Date(t).toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'short',
            timeZone: 'UTC',
          })}
        </text>
      ))}

      <path className="line earth" d={linePath('earth_el')} />
      <path className="line sun" d={linePath('sun_el')} />

      {activeSample && (
        <g>
          <line
            className="cursor-line"
            x1={x(activeSample.t)}
            x2={x(activeSample.t)}
            y1={PAD.t}
            y2={H - PAD.b}
          />
          <circle cx={x(activeSample.t)} cy={y(activeSample.sun_el)} r={5} className="dot sun" />
          <circle cx={x(activeSample.t)} cy={y(activeSample.earth_el)} r={5} className="dot earth" />
          <text
            className="cursor-epoch-label"
            x={Math.min(W - PAD.r - 40, Math.max(PAD.l + 40, x(activeSample.t)))}
            y={H - 22}
            textAnchor="middle"
          >
            {new Date(activeSample.t).toLocaleDateString('es-MX', {
              day: 'numeric',
              month: 'short',
              timeZone: 'UTC',
            })}{' '}
            · {activeSample.t.slice(11, 16)}
          </text>
        </g>
      )}

      {last && (
        <>
          <text className="label sun" x={W - PAD.r + 8} y={y(last.sun_el) + 4}>
            Sol
          </text>
          <text className="label earth" x={W - PAD.r + 8} y={y(last.earth_el) + 4}>
            Tierra
          </text>
        </>
      )}
    </svg>
  )
}
