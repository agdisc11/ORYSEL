import { useState } from 'react'
import { AWS_BASE_URL, type AwsTelemetryState } from '../ephemeris/awsApi.ts'
import type { Sample, Site, ViabilityKPI } from '../ephemeris/types.ts'

interface ArchitectureDefensePanelProps {
  /** Kept for callers; the panel no longer shows per-site model values. */
  site?: Site
  viability?: ViabilityKPI
  activeSample: Sample
  awsTelemetry: AwsTelemetryState
  clientFps: number
  onClose: () => void
}

const INTEGRATION_SNIPPET = `// API de ORYSEL en AWS EC2 (FastAPI + PostgreSQL 16). Requiere una cuenta.
// 1. Iniciar sesión y obtener un token
const login = await fetch('${AWS_BASE_URL}/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'tu@correo.com', password: 'tu-contraseña' }),
});
const { token } = await login.json();

// 2. Llamar la API con el token
const res = await fetch('${AWS_BASE_URL}/api/sites', {
  headers: { Authorization: \`Bearer \${token}\` },
});
const { source, metrics } = await res.json();
console.log('Fuente:', source, metrics);`

export function ArchitectureDefensePanel({
  awsTelemetry,
  clientFps,
  onClose,
}: ArchitectureDefensePanelProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard?.writeText(INTEGRATION_SNIPPET)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="arch-modal-title"
    >
      <div className="modal-card modal-wide">
        <div className="modal-header">
          <span className="pill-badge">ARQUITECTURA EN 3 CAPAS · API EN AWS · ASESORÍA</span>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Cerrar modal">
            ✕ Cerrar
          </button>
        </div>

        <h2 id="arch-modal-title">Arquitectura en 3 capas y API con cuentas en AWS EC2</h2>

        <div className="defense-grid">
          {/* (a) 3 Capas con telemetría en vivo */}
          <div className="defense-card highlight">
            <span className="pill-badge">A · ARQUITECTURA EN 3 CAPAS (MÉTRICAS EN VIVO)</span>
            <h3>Frontend 60 FPS + Backend AWS EC2 + Kernel Físico</h3>
            <ul className="layer-list">
              <li>
                <strong>Capa 1 · Presentación Cliente (React 19 + Vite):</strong> Renderizado
                vectorial SVG memorizado manteniendo{' '}
                <strong className="mono">{clientFps} FPS</strong> en tiempo real sin bloquear el
                hilo principal.
              </li>
              <li>
                <strong>Capa 2 · Backend Cloud AWS EC2 (`{awsTelemetry.awsRegion}`):</strong>{' '}
                Servidor Ubuntu 24.04 con <strong>{awsTelemetry.engine}</strong> en{' '}
                <code className="mono">{AWS_BASE_URL}</code>. Ping RTT:{' '}
                <strong className="mono">
                  {awsTelemetry.pingRttMs !== null ? `${awsTelemetry.pingRttMs} ms` : 'Cache'}
                </strong>{' '}
                | Query SQL: <strong className="mono">{awsTelemetry.dbQueryMs} ms</strong> |{' '}
                <strong className="mono">
                  {awsTelemetry.horizonsRecords.toLocaleString('en-US')} registros
                </strong>{' '}
                de NASA JPL Horizons en <code>prueba.horizons_im2</code>.
              </li>
              <li>
                <strong>Capa 3 · Kernel Físico (`src/ephemeris/`):</strong> Cinemática en marco{' '}
                <code>MOON_ME</code> con NASA NAIF SPICE (<code>timecraftjs</code>, DE440):
                posiciones aparentes del Sol y la Tierra (LT+S), cruces del horizonte al segundo y
                ventanas de luz y comunicación. <em>Trabajo futuro:</em> trayectorias de descenso
                (Kepler, Euler-Lagrange) y dispersión gaussiana del punto de alunizaje.
              </li>
            </ul>
          </div>

          {/* (b) Respaldo Académico Multidisciplinario UP */}
          <div className="defense-card">
            <span className="pill-badge">B · ASESORÍA ACADÉMICA (UNIVERSIDAD POLITÉCNICA)</span>
            <h3>Áreas de consulta</h3>
            <ul className="layer-list">
              <li>
                <strong>Programación y arquitectura de software:</strong> Dr. Horacio.
              </li>
              <li>
                <strong>Electrónica y telemetría:</strong> Prof. Jorge y Dr. Manuel Martínez.
              </li>
              <li>
                <strong>Física y probabilidad:</strong> Dr. Mendoza y Dr. Montero.
              </li>
            </ul>
            <p className="muted">
              El cálculo y el código son del equipo ORYSEL; la asesoría orienta el trabajo futuro.
            </p>
          </div>
        </div>

        {/* (c) Interoperabilidad y API Abierta en AWS */}
        <div className="interop-box">
          <div className="interop-header">
            <div>
              <span className="pill-badge">C · INTEROPERABILIDAD · API EN AWS EC2</span>
              <h3>Endpoints REST para integración (requieren cuenta y token)</h3>
            </div>
            <div className="interop-links">
              <a
                href={`${AWS_BASE_URL}/docs`}
                target="_blank"
                rel="noreferrer"
                className="btn-primary btn-link"
              >
                Abrir Swagger UI (`/docs`) ↗
              </a>
              <a
                href={`${AWS_BASE_URL}/api/ping`}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary btn-link"
              >
                `/api/ping` ↗
              </a>
              <a
                href={`${AWS_BASE_URL}/api/sites`}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary btn-link"
              >
                `/api/sites` ↗
              </a>
            </div>
          </div>

          <pre className="code-snippet mono">{INTEGRATION_SNIPPET}</pre>

          <div className="interop-footer">
            <span className="muted">
              Cualquier agencia, universidad o plataforma web puede consultar las 5,768 efemérides
              de PostgreSQL en tiempo real.
            </span>
            <button type="button" className="btn-chip" onClick={handleCopy}>
              {copied ? '✓ Snippet Copiado' : 'Copiar Snippet de Integración'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
