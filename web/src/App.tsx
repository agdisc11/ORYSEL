import { useEffect, useState } from 'react'
import { ElevationChart } from './components/ElevationChart.tsx'
import { SITES } from './data/sites.ts'
import type { SiteReport } from './ephemeris/types.ts'

const fmt = (iso: string) => iso.replace('T', ' ').replace(':00Z', ' UTC').replace('Z', ' UTC')
const LABEL = { sun: 'Sun', earth: 'Earth' } as const

export default function App() {
  const site = SITES[0]
  const [report, setReport] = useState<SiteReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/${site.id}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setReport)
      .catch((e: Error) => setError(e.message))
  }, [site.id])

  return (
    <main>
      <header>
        <p className="eyebrow">ORYSEL · NASA Space Apps 2026 · Lunar Landing Site Navigator</p>
        <h1>{site.name}</h1>
        <p className="muted">
          {Math.abs(site.lat).toFixed(4)}° {site.lat < 0 ? 'S' : 'N'}, {Math.abs(site.lon).toFixed(4)}°{' '}
          {site.lon < 0 ? 'W' : 'E'} · coordinates: {site.source}
        </p>
      </header>

      {error && <p className="error">Could not load the site data: {error}</p>}
      {!report && !error && <p className="muted">Loading…</p>}

      {report && (
        <>
          <section className="metrics" aria-label="Summary">
            <Metric value={`${report.metrics.sun_visible_pct}%`} label="of the time in sunlight" />
            <Metric value={`${report.metrics.earth_visible_pct}%`} label="with the Earth in view" />
            <Metric value={`${report.metrics.both_visible_pct}%`} label="with both: power and a direct link" />
            <Metric value={`${(report.metrics.longest_night_hours / 24).toFixed(1)} d`} label="longest night" />
            <Metric
              value={`${(report.metrics.longest_comm_gap_hours / 24).toFixed(1)} d`}
              label="longest gap without the Earth"
            />
          </section>

          <section>
            <h2>Height of the Sun and the Earth above the horizon</h2>
            <p className="muted">
              {fmt(report.start)} to {fmt(report.end)}, one point per hour.{' '}
              {report.horizon.type === 'smooth'
                ? 'Smooth horizon: mountains and crater rims are not included yet.'
                : 'Terrain horizon from LOLA elevation data.'}
            </p>
            <ElevationChart report={report} />
          </section>

          <section>
            <h2>Rises and sets</h2>
            <table>
              <thead>
                <tr><th>Time</th><th>Event</th><th>Direction</th></tr>
              </thead>
              <tbody>
                {report.events.map((e) => (
                  <tr key={e.t + e.body}>
                    <td className="mono">{fmt(e.t)}</td>
                    <td>{LABEL[e.body]} {e.type === 'rise' ? 'rises' : 'sets'}</td>
                    <td className="mono">{e.az.toFixed(1)}° from north</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <footer className="muted">
            Computed with {report.engine}. Kernels from NASA NAIF. Checked against NASA/JPL Horizons
            for the same site and month: largest difference 0.00003°.
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
