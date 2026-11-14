import type { SiteReport } from '../ephemeris/types.ts'

const W = 960
const H = 320
const PAD = { l: 48, r: 74, t: 18, b: 32 }

export interface ElevationChartProps {
  report: SiteReport
  selectedIndex?: number
  onSelectIndex?: (index: number) => void
}

/**
 * Elevation of the Sun and the Earth over the whole report, with daylight windows,
 * topographic/communication threshold line, blind-spot danger zone, and interactive cursor.
 */
export function ElevationChart({ report, selectedIndex, onSelectIndex }: ElevationChartProps) {
  const { series, windows, horizon, site } = report
  const t0 = Date.parse(report.start)
  const t1 = Date.parse(report.end)
  const terrainMaskDeg =
    horizon.profile && horizon.profile.length > 0
      ? horizon.profile.reduce((a, b) => a + b, 0) / horizon.profile.length
      : 0
  const commThresholdDeg = Math.max(terrainMaskDeg, site.minCommElevationDeg ?? 0)

  const els = series.flatMap((s) => [s.sun_el, s.earth_el, commThresholdDeg])
  const lo = Math.floor(Math.min(...els, -2) / 2) * 2
  const hi = Math.ceil(Math.max(...els, 4) / 2) * 2
  const spanDeg = Math.max(4, hi - lo)
  const stepTick = spanDeg > 40 ? 15 : spanDeg > 18 ? 5 : 2

  const x = (iso: string | number) =>
    PAD.l + (((typeof iso === 'number' ? iso : Date.parse(iso)) - t0) / (t1 - t0)) * (W - PAD.l - PAD.r)
  const y = (el: number) => PAD.t + ((hi - el) / (hi - lo)) * (H - PAD.t - PAD.b)
  const path = (key: 'sun_el' | 'earth_el') =>
    series.map((s, i) => `${i ? 'L' : 'M'}${x(s.t).toFixed(1)},${y(s[key]).toFixed(1)}`).join('')

  const days: number[] = []
  for (let t = t0; t <= t1; t += 5 * 86_400_000) days.push(t)
  const ticks: number[] = []
  for (let v = lo; v <= hi; v += stepTick) ticks.push(v)
  const last = series[series.length - 1]
  const activeSample =
    selectedIndex !== undefined && series[selectedIndex] ? series[selectedIndex] : null

  const yZero = y(0)
  const yMask = y(commThresholdDeg)
  const yBottom = H - PAD.b

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      className="chart"
      aria-label="Elevación del Sol y de la Tierra sobre el horizonte en el tiempo"
      onClick={(e) => {
        if (!onSelectIndex || series.length === 0) return
        const rect = e.currentTarget.getBoundingClientRect()
        const relX = ((e.clientX - rect.left) / rect.width) * W
        const frac = Math.min(1, Math.max(0, (relX - PAD.l) / (W - PAD.l - PAD.r)))
        onSelectIndex(Math.round(frac * (series.length - 1)))
      }}
    >
      {/* Daylight windows */}
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

      {/* Topographic mask / minimum communication link line */}
      {commThresholdDeg > 0.2 && (
        <g>
          <line
            className="mask-line"
            x1={PAD.l}
            x2={W - PAD.r}
            y1={yMask}
            y2={yMask}
          />
          <text className="mask-label" x={PAD.l + 8} y={yMask - 5}>
            Umbral Enlace / Máscara Topográfica ({commThresholdDeg.toFixed(1)}°)
          </text>
        </g>
      )}

      {days.map((t) => (
        <text key={t} className="tick" x={x(t)} y={H - 8} textAnchor="middle">
          {new Date(t).toLocaleDateString('es-MX', {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
          })}
        </text>
      ))}

      <path className="line sun" d={path('sun_el')} />
      <path className="line earth" d={path('earth_el')} />

      {activeSample && (
        <g>
          <line
            className="cursor-line"
            x1={x(activeSample.t)}
            x2={x(activeSample.t)}
            y1={PAD.t}
            y2={H - PAD.b}
          />
          <circle cx={x(activeSample.t)} cy={y(activeSample.sun_el)} r={4.5} className="dot sun" />
          <circle cx={x(activeSample.t)} cy={y(activeSample.earth_el)} r={4.5} className="dot earth" />
        </g>
      )}

      <text className="label sun" x={W - PAD.r + 6} y={y(last.sun_el) + 4}>
        Sol
      </text>
      <text className="label earth" x={W - PAD.r + 6} y={y(last.earth_el) + 4}>
        Tierra
      </text>
      <text className="tick" x={PAD.l + 6} y={yZero - 5}>
        horizonte (0°)
      </text>
    </svg>
  )
}
