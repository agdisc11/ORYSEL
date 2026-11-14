import type { SiteReport } from '../ephemeris/types.ts'

const W = 960
const H = 320
const PAD = { l: 44, r: 64, t: 14, b: 30 }

/** Elevation of the Sun and the Earth over the whole report, with night shaded. */
export function ElevationChart({ report }: { report: SiteReport }) {
  const { series, windows } = report
  const t0 = Date.parse(report.start)
  const t1 = Date.parse(report.end)
  const els = series.flatMap((s) => [s.sun_el, s.earth_el])
  const lo = Math.floor(Math.min(...els, -2) / 2) * 2
  const hi = Math.ceil(Math.max(...els, 2) / 2) * 2

  const x = (iso: string | number) =>
    PAD.l + (((typeof iso === 'number' ? iso : Date.parse(iso)) - t0) / (t1 - t0)) * (W - PAD.l - PAD.r)
  const y = (el: number) => PAD.t + ((hi - el) / (hi - lo)) * (H - PAD.t - PAD.b)
  const path = (key: 'sun_el' | 'earth_el') =>
    series.map((s, i) => `${i ? 'L' : 'M'}${x(s.t).toFixed(1)},${y(s[key]).toFixed(1)}`).join('')

  const days: number[] = []
  for (let t = t0; t <= t1; t += 5 * 86_400_000) days.push(t)
  const ticks: number[] = []
  for (let v = lo; v <= hi; v += 2) ticks.push(v)
  const last = series[series.length - 1]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" className="chart"
      aria-label="Elevation of the Sun and the Earth above the horizon over time">
      {windows.filter((w) => w.kind === 'sun').map((w) => (
        <rect key={w.start} className="day" x={x(w.start)} y={PAD.t}
          width={x(w.end) - x(w.start)} height={H - PAD.t - PAD.b} />
      ))}
      {ticks.map((v) => (
        <g key={v}>
          <line className={v === 0 ? 'horizon' : 'grid'} x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} />
          <text className="tick" x={PAD.l - 8} y={y(v) + 4} textAnchor="end">{v}°</text>
        </g>
      ))}
      {days.map((t) => (
        <text key={t} className="tick" x={x(t)} y={H - 8} textAnchor="middle">
          {new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
        </text>
      ))}
      <path className="line sun" d={path('sun_el')} />
      <path className="line earth" d={path('earth_el')} />
      <text className="label sun" x={W - PAD.r + 6} y={y(last.sun_el) + 4}>Sun</text>
      <text className="label earth" x={W - PAD.r + 6} y={y(last.earth_el) + 4}>Earth</text>
      <text className="tick" x={PAD.l + 6} y={y(0) - 6}>horizon</text>
    </svg>
  )
}
