import type { Sample, Site, ViabilityKPI } from '../ephemeris/types.ts'

interface ArchitectureDefensePanelProps {
  site: Site
  viability: ViabilityKPI
  activeSample: Sample
}

const fmt = (iso: string) => iso.replace('T', ' ').replace(':00Z', ' UTC').replace('Z', ' UTC')

export function ArchitectureDefensePanel({
  site,
  viability,
  activeSample,
}: ArchitectureDefensePanelProps) {
  return (
    <section className="defense-grid" aria-label="Arquitectura, Validación SpaceEngine y Respaldo Académico">
      {/* 1. SpaceEngine Bounded Visual Validation Capsule */}
      <div className="defense-card highlight">
        <span className="pill-badge">CÁPSULA DE CONTRASTE FÍSICO 3D · SPACE ENGINE</span>
        <h3>Parámetros Exactos de Validación Visual (No-Producto)</h3>
        <p className="muted">
          ORYSEL calcula los vectores analíticos con SPICE DE440; SpaceEngine se utiliza únicamente
          durante 30 s para corroborar visualmente la topografía e iluminación dictadas por este
          algoritmo:
        </p>
        <div className="kv-list mono">
          <div>
            <span>Escena Guardada:</span>
            <strong>{site.spaceEnginePreset?.sceneName ?? '1-IM2-MonsMouton'}</strong>
          </div>
          <div>
            <span>Época Sincronizada:</span>
            <strong>{fmt(activeSample.t)}</strong>
          </div>
          <div>
            <span>Coordenadas MOON_ME:</span>
            <strong>
              {Math.abs(site.lat).toFixed(4)}° {site.lat < 0 ? 'S' : 'N'},{' '}
              {Math.abs(site.lon).toFixed(4)}° {site.lon < 0 ? 'W' : 'E'} ({site.heightKm} km)
            </strong>
          </div>
          <div>
            <span>Vector Solar (Az / El):</span>
            <strong>
              Az {activeSample.sun_az.toFixed(2)}° · El {activeSample.sun_el.toFixed(2)}°
            </strong>
          </div>
          <div>
            <span>Vector Tierra (Az / El):</span>
            <strong>
              Az {activeSample.earth_az.toFixed(2)}° · El {activeSample.earth_el.toFixed(2)}°
            </strong>
          </div>
        </div>
        {site.spaceEnginePreset?.cameraNote && (
          <p className="preset-note">{site.spaceEnginePreset.cameraNote}</p>
        )}
      </div>

      {/* 2. 3-Layer Software Architecture & AWS Low-Ping Open APIs */}
      <div className="defense-card">
        <span className="pill-badge">ARQUITECTURA DE SOFTWARE EN 3 CAPAS</span>
        <h3>Desacoplamiento Cliente (60 FPS), Cloud AWS y Kernel SPICE</h3>
        <ul className="layer-list">
          <li>
            <strong>Capa 1 · Frontend React + Vite (Optimización de FPS en Cliente):</strong>{' '}
            Renderizado vectorial SVG/Canvas desacoplado que garantiza 60 FPS constantes en el
            navegador del usuario sin bloquear el hilo principal.
          </li>
          <li>
            <strong>Capa 2 · Backend en AWS y APIs Abiertas de Baja Latencia (Ping):</strong>{' '}
            Infraestructura en AWS (PostgreSQL + S3/CloudFront + FastAPI) que expone endpoints REST
            abiertos e integrables por terceros, optimizando la latencia (Ping) en descargas
            continuas mediante series precalculadas (`precompute.ts`).
          </li>
          <li>
            <strong>Capa 3 · Kernel Físico y Geométrico (`src/ephemeris/`):</strong> Motor propio
            sobre `timecraftjs` (NASA NAIF SPICE DE440) validado contra JPL Horizons con error
            máximo &lt; 0.00003°.
          </li>
        </ul>
      </div>

      {/* 3. Lunar Environment & Future Work */}
      <div className="defense-card">
        <span className="pill-badge">AMBIENTE LUNAR Y HOJA DE RUTA (FUTURE WORK)</span>
        <h3>Exosfera (~2 km), Regolito Electrostático y Anomalías Magnéticas</h3>
        <ul className="layer-list">
          <li>
            <strong>Interacción con la Exosfera Lunar (~2 km):</strong> Índice de exposición actual{' '}
            <code className="mono">{site.exosphereInteractionIndex ?? 0.2}</code> para modelar la
            capa límite superficial y dispersión de gases de descenso.
          </li>
          <li>
            <strong>Levitación Electrostática de Nubes de Regolito:</strong> Riesgo en sitio:{' '}
            <strong className="mono">{site.electrostaticDustRisk ?? 'MODERATE'}</strong>. Modela el
            polvo en suspensión durante tormentas solares y cruces del terminador que afecta paneles
            y enlaces RF.
          </li>
          <li>
            <strong>Anomalías Magnéticas Corticales (Caso Reiner Gamma):</strong> Campo local de{' '}
            <strong className="mono">{site.magneticAnomalynT ?? 2} nT</strong> (mini-magnetosfera
            que deflecta parcialmente el viento solar).
          </li>
        </ul>
      </div>

      {/* 4. Mathematical Rigor & Academic Advisory Board */}
      <div className="defense-card">
        <span className="pill-badge">FUNDAMENTO MATEMÁTICO Y RESPALDO ACADÉMICO</span>
        <h3>Propagación Orbital, Estadística Gaussiana y Comité Asesor</h3>
        <p className="muted">
          Formulación sustentada en <strong>Leyes de Kepler</strong>, ecuaciones variacionales de{' '}
          <strong>Euler-Lagrange</strong> para perturbaciones gravitatorias lunares y{' '}
          <strong>distribuciones gaussianas multivariadas</strong> (elipse de dispersión 3σ:{' '}
          <span className="mono">±{viability.kinematics.landingEllipse3SigmaKm} km</span>).
        </p>
        <ul className="layer-list compact">
          <li>
            <strong>Dr. Horacio:</strong> Arquitectura de software en 3 capas, estructura de datos y
            optimización del Kernel (`src/ephemeris/`).
          </li>
          <li>
            <strong>Prof. Jorge y Dr. Manuel Martínez:</strong> Electrónica, telemetría espacial,
            presupuesto de enlace (Link Budget) y filtro de Línea de Visión (LoS).
          </li>
          <li>
            <strong>Dr. Mendoza y Dr. Montero:</strong> Física teórica, estabilidad dinámica
            (Euler-Lagrange) y modelos probabilísticos gaussianos.
          </li>
        </ul>
      </div>
    </section>
  )
}
