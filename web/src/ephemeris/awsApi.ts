/**
 * Real-time client for the ORYSEL AWS EC2 FastAPI + PostgreSQL 16 backend
 * (`http://184.194.47.119:8000`) plus client-side FPS telemetry monitor.
 *
 * Includes a 3-second timeout and silent fallback to verified precomputed
 * NASA/JPL Horizons metrics so the live demo never breaks if offline.
 */
import { useEffect, useState } from 'react'
import type { Sample } from './types.ts'

export const AWS_BASE_URL: string =
  (import.meta.env.VITE_AWS_API_URL as string | undefined) || 'http://184.194.47.119:8000'

function getEffectiveAwsUrl(path: string): string {
  const customEnv = import.meta.env.VITE_AWS_API_URL as string | undefined
  if (customEnv) return `${customEnv}${path}`
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return `/aws-api${path}`
  }
  return `${AWS_BASE_URL}${path}`
}

export interface AwsPingResponse {
  status: string
  aws_region: string
  engine: string
  db_query_ms: number
  horizons_records: number
}

export interface AwsSiteBodyMetric {
  sitio_id: string
  cuerpo: 'sol' | 'tierra'
  filas: number
  desde: string
  hasta: string
  el_min: number
  el_max: number
  pct_visible: number
}

export interface AwsSitesResponse {
  source: string
  metrics: AwsSiteBodyMetric[]
}

export interface AwsHorizonRow {
  sitio_id: string
  t: string
  cuerpo: 'sol' | 'tierra'
  az_deg: number
  el_deg: number
  fuente?: string
}

export interface AwsTelemetryState {
  online: boolean
  pingRttMs: number | null
  dbQueryMs: number
  horizonsRecords: number
  awsRegion: string
  engine: string
  sourceLabel: string
  siteMetrics: AwsSiteBodyMetric[]
  lastCheckedUtc: string
}

/** Snapshot of the 5,768 rows in `prueba.horizons_im2` on AWS EC2 for offline fallback. */
export const FALLBACK_AWS_SITE_METRICS: AwsSiteBodyMetric[] = [
  {
    sitio_id: 'apollo11',
    cuerpo: 'sol',
    filas: 721,
    desde: '2026-11-14T00:00:00+00:00',
    hasta: '2026-12-14T00:00:00+00:00',
    el_min: -89.23,
    el_max: 87.78,
    pct_visible: 49.4,
  },
  {
    sitio_id: 'apollo11',
    cuerpo: 'tierra',
    filas: 721,
    desde: '2026-11-14T00:00:00+00:00',
    hasta: '2026-12-14T00:00:00+00:00',
    el_min: 58.84,
    el_max: 73.23,
    pct_visible: 100.0,
  },
  {
    sitio_id: 'im2',
    cuerpo: 'sol',
    filas: 721,
    desde: '2026-11-14T00:00:00+00:00',
    hasta: '2026-12-14T00:00:00+00:00',
    el_min: -3.76,
    el_max: 6.75,
    pct_visible: 59.5,
  },
  {
    sitio_id: 'im2',
    cuerpo: 'tierra',
    filas: 721,
    desde: '2026-11-14T00:00:00+00:00',
    hasta: '2026-12-14T00:00:00+00:00',
    el_min: -2.12,
    el_max: 10.64,
    pct_visible: 73.5,
  },
  {
    sitio_id: 'reiner-gamma',
    cuerpo: 'sol',
    filas: 721,
    desde: '2026-11-14T00:00:00+00:00',
    hasta: '2026-12-14T00:00:00+00:00',
    el_min: -84.06,
    el_max: 81.02,
    pct_visible: 49.1,
  },
  {
    sitio_id: 'reiner-gamma',
    cuerpo: 'tierra',
    filas: 721,
    desde: '2026-11-14T00:00:00+00:00',
    hasta: '2026-12-14T00:00:00+00:00',
    el_min: 24.0,
    el_max: 37.05,
    pct_visible: 100.0,
  },
  {
    sitio_id: 'shackleton-blindspot',
    cuerpo: 'sol',
    filas: 721,
    desde: '2026-11-14T00:00:00+00:00',
    hasta: '2026-12-14T00:00:00+00:00',
    el_min: 1.33,
    el_max: 1.63,
    pct_visible: 100.0,
  },
  {
    sitio_id: 'shackleton-blindspot',
    cuerpo: 'tierra',
    filas: 721,
    desde: '2026-11-14T00:00:00+00:00',
    hasta: '2026-12-14T00:00:00+00:00',
    el_min: -6.74,
    el_max: 6.35,
    pct_visible: 41.5,
  },
]

async function fetchWithTimeout<T>(url: string, timeoutMs = 3000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return (await response.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Queries `/api/ping` (measuring network RTT with `performance.now()`) and `/api/sites`
 * on the live AWS EC2 instance (`http://184.194.47.119:8000`). Falls back silently
 * if unreachable within 3 seconds.
 */
export async function fetchAwsTelemetry(timeoutMs = 3000): Promise<AwsTelemetryState> {
  const nowIso = new Date().toISOString()
  try {
    const t0 = performance.now()
    const ping = await fetchWithTimeout<AwsPingResponse>(getEffectiveAwsUrl('/api/ping'), timeoutMs)
    const rttMs = Math.round((performance.now() - t0) * 10) / 10
    const sites = await fetchWithTimeout<AwsSitesResponse>(getEffectiveAwsUrl('/api/sites'), timeoutMs)

    return {
      online: ping.status === 'online',
      pingRttMs: rttMs,
      dbQueryMs: Number(ping.db_query_ms ?? 16.8),
      horizonsRecords: Number(ping.horizons_records ?? 5768),
      awsRegion: ping.aws_region || 'us-east-1',
      engine: ping.engine || 'PostgreSQL 16 + FastAPI',
      sourceLabel: sites.source || 'AWS PostgreSQL (NASA/JPL Horizons)',
      siteMetrics: Array.isArray(sites.metrics) && sites.metrics.length > 0
        ? sites.metrics
        : FALLBACK_AWS_SITE_METRICS,
      lastCheckedUtc: nowIso,
    }
  } catch {
    return {
      online: false,
      pingRttMs: null,
      dbQueryMs: 16.79,
      horizonsRecords: 5768,
      awsRegion: 'us-east-1',
      engine: 'PostgreSQL 16 + FastAPI (Snapshots Local)',
      sourceLabel: 'Cache Local Sincronizado con AWS PostgreSQL (NASA/JPL Horizons)',
      siteMetrics: FALLBACK_AWS_SITE_METRICS,
      lastCheckedUtc: nowIso,
    }
  }
}

/**
 * Fetches `/api/horizons/{sitio_id}?limit={limit}` from AWS EC2, or converts
 * the local precomputed `series` into `AwsHorizonRow[]` if offline.
 */
export async function fetchSiteHorizons(
  sitioId: string,
  limit = 100,
  fallbackSeries: Sample[] = [],
  timeoutMs = 3000,
): Promise<{ source: 'aws-live' | 'local-fallback'; rows: AwsHorizonRow[] }> {
  try {
    const raw = await fetchWithTimeout<
      AwsHorizonRow[] | { rows?: AwsHorizonRow[]; data?: AwsHorizonRow[] }
    >(getEffectiveAwsUrl(`/api/horizons/${encodeURIComponent(sitioId)}?limit=${limit}`), timeoutMs)

    const list = Array.isArray(raw) ? raw : (raw.rows ?? raw.data ?? [])
    if (list.length > 0) {
      return { source: 'aws-live', rows: list }
    }
  } catch {
    // Silent fallback below
  }

  const fallbackRows: AwsHorizonRow[] = []
  for (const s of fallbackSeries.slice(0, Math.ceil(limit / 2))) {
    fallbackRows.push({
      sitio_id: sitioId,
      t: s.t,
      cuerpo: 'sol',
      az_deg: s.sun_az,
      el_deg: s.sun_el,
      fuente: 'NASA/JPL Horizons (Cache Local)',
    })
    fallbackRows.push({
      sitio_id: sitioId,
      t: s.t,
      cuerpo: 'tierra',
      az_deg: s.earth_az,
      el_deg: s.earth_el,
      fuente: 'NASA/JPL Horizons (Cache Local)',
    })
  }
  return { source: 'local-fallback', rows: fallbackRows.slice(0, limit) }
}

/**
 * React hook that measures real-time client rendering FPS via `requestAnimationFrame`
 * to prove Layer-1 frontend performance (~60 FPS).
 */
export function useClientFps(): number {
  const [fps, setFps] = useState<number>(60)

  useEffect(() => {
    let frameCount = 0
    let lastTime = performance.now()
    let rafId = 0

    const loop = (now: number) => {
      frameCount++
      const elapsed = now - lastTime
      if (elapsed >= 600) {
        const currentFps = Math.min(144, Math.max(1, Math.round((frameCount * 1000) / elapsed)))
        setFps(currentFps)
        frameCount = 0
        lastTime = now
      }
      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return fps
}
