import { useState } from 'react'
import type { Site, ViabilityKPI } from '../ephemeris/types.ts'

interface RocketVectorPlaygroundProps {
  site: Site
  viability: ViabilityKPI
}

/**
 * Exclusive view for the Kids / Gamified segment:
 * 1) Renders ONLY a giant binary verdict ("¡SÍ SE PUEDE ATERRIZAR!" / "¡NO SE PUEDE, PERDEMOS SEÑAL!")
 *    instead of percentages.
 * 2) Provides an interactive 2D vector velocity playground on a lunar rocket.
 */
export function RocketVectorPlayground({ site, viability }: RocketVectorPlaygroundProps) {
  const vOrbital = viability.kinematics.orbitalVelocityKmS // ~1.68 km/s
  const vEscape = viability.kinematics.escapeVelocityKmS // ~2.38 km/s

  const [tangentialKmS, setTangentialKmS] = useState<number>(1.25)
  const [brakingKmS, setBrakingKmS] = useState<number>(0.45)

  const netSpeed = Number(Math.hypot(tangentialKmS, brakingKmS * 0.4).toFixed(2))

  let trajectoryState: 'LANDING' | 'ORBIT' | 'ESCAPE'
  let trajectoryTitle: string
  let trajectoryDesc: string
  let pathD: string
  let pathColor: string

  if (netSpeed < vOrbital) {
    trajectoryState = 'LANDING'
    trajectoryTitle = '¡ALUNIZAJE SUAVE EN LA LUNA!'
    trajectoryDesc =
      'Tu flecha de velocidad es menor que 1.68 km/s y encendiste los motores de frenado: la gravedad lunar baja el cohete suavemente hasta la superficie.'
    pathD = 'M 140 85 Q 290 95 415 212'
    pathColor = '#4ce0b3'
  } else if (netSpeed < vEscape) {
    trajectoryState = 'ORBIT'
    trajectoryTitle = '¡EL COHETE ENTRÓ EN ÓRBITA LUNAR!'
    trajectoryDesc =
      'Tu flecha de velocidad está entre 1.68 y 2.38 km/s: equilibra la gravedad de la Luna y el cohete queda girando alrededor como un satélite.'
    pathD = 'M 140 85 Q 350 40 540 165'
    pathColor = '#5fa8f5'
  } else {
    trajectoryState = 'ESCAPE'
    trajectoryTitle = '¡VELOCIDAD DE ESCAPE! SE VA AL ESPACIO PROFUNDO'
    trajectoryDesc =
      '¡La flecha supera los 2.38 km/s! El cohete vence por completo la gravedad de la Luna y se escapa hacia el espacio exterior.'
    pathD = 'M 140 85 Q 320 65 560 22'
    pathColor = '#f2b53a'
  }

  const arrowTangentialLen = Math.round(40 + (tangentialKmS / 3.0) * 140)
  const arrowBrakingLen = Math.round(20 + (brakingKmS / 1.5) * 75)

  return (
    <section className="kids-section" aria-label="Vista Infantil y Simulador de Vectores">
      <div className={`binary-verdict-banner ${viability.isViable ? 'yes' : 'no'}`}>
        <span className="pill-badge">VEREDICTO DE MISIÓN PARA EXPLORADORES</span>
        <div className="binary-badge">
          {viability.isViable
            ? '¡SÍ SE PUEDE ATERRIZAR!'
            : '¡NO SE PUEDE, PERDEMOS SEÑAL!'}
        </div>
        <p>
          {viability.isViable
            ? `En ${site.name} tenemos energía del Sol para nuestras baterías y línea de vista directa con la Tierra y con el satélite fotográfico.`
            : `En ${site.name} las paredes gigantes del cráter tapan nuestra antena con la Tierra y bloquean la cámara del satélite. ¡Elige Reiner Gamma o IM-2 en la barra superior!`}
        </p>
      </div>

      <div className="vector-playground-card">
        <div className="playground-header">
          <div>
            <span className="pill-badge">SIMULADOR INTERACTIVO DE VECTORES</span>
            <h3>¡Mueve las Flechas Vectoriales de Velocidad del Cohete!</h3>
            <p className="muted">
              Cambia el tamaño de las flechas para descubrir cuándo el cohete aterriza en la Luna,
              cuándo entra en órbita y cuándo se escapa al espacio.
            </p>
          </div>
          <div className="preset-buttons">
            <button
              type="button"
              className="btn-chip"
              onClick={() => {
                setTangentialKmS(1.1)
                setBrakingKmS(0.6)
              }}
            >
              1. Aterrizar
            </button>
            <button
              type="button"
              className="btn-chip"
              onClick={() => {
                setTangentialKmS(1.75)
                setBrakingKmS(0.2)
              }}
            >
              2. Entrar en Órbita
            </button>
            <button
              type="button"
              className="btn-chip"
              onClick={() => {
                setTangentialKmS(2.6)
                setBrakingKmS(0.1)
              }}
            >
              3. Escapar al Espacio
            </button>
          </div>
        </div>

        <svg
          viewBox="0 0 620 260"
          className="rocket-canvas"
          role="img"
          aria-label="Simulador visual de vectores de velocidad del cohete sobre la Luna"
        >
          <defs>
            <marker
              id="vec-arrow-green"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#4ce0b3" />
            </marker>
            <marker
              id="vec-arrow-amber"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f2b53a" />
            </marker>
          </defs>

          <circle cx="60" cy="35" r="1.5" fill="#fff" opacity="0.6" />
          <circle cx="240" cy="25" r="1.5" fill="#fff" opacity="0.5" />
          <circle cx="480" cy="48" r="2" fill="#fff" opacity="0.7" />
          <circle cx="550" cy="95" r="1.5" fill="#fff" opacity="0.4" />

          <path
            d="M 0 235 Q 310 175 620 235 L 620 260 L 0 260 Z"
            fill="#283246"
            stroke="#5fa8f5"
            strokeWidth="2"
          />
          <ellipse
            cx="415"
            cy="215"
            rx="28"
            ry="7"
            fill="#18202c"
            stroke="#4ce0b3"
            strokeDasharray="4 3"
          />
          <text x="415" y="242" textAnchor="middle" fill="#e9ecf1" fontSize="11">
            Pista: {site.name.split(' ')[0]}
          </text>

          <path d={pathD} fill="none" stroke={pathColor} strokeWidth="3.5" strokeDasharray="7 5" />

          <line
            x1="140"
            y1="85"
            x2={140 + arrowTangentialLen}
            y2="85"
            stroke="#f2b53a"
            strokeWidth="4"
            markerEnd="url(#vec-arrow-amber)"
          />
          <text
            x={140 + arrowTangentialLen / 2}
            y="72"
            textAnchor="middle"
            fill="#f2b53a"
            fontSize="12"
            fontWeight="bold"
          >
            Flecha Velocidad ({tangentialKmS.toFixed(2)} km/s)
          </text>

          <line
            x1="140"
            y1="85"
            x2="140"
            y2={85 + arrowBrakingLen}
            stroke="#4ce0b3"
            strokeWidth="3.5"
            markerEnd="url(#vec-arrow-green)"
          />
          <text x="128" y={92 + arrowBrakingLen / 2} textAnchor="end" fill="#4ce0b3" fontSize="11">
            Descenso ({brakingKmS.toFixed(2)} km/s)
          </text>

          <g transform="translate(140, 85)">
            <polygon
              points="-18,-10 18,0 -18,10 -12,0"
              fill="#e9ecf1"
              stroke="#5fa8f5"
              strokeWidth="2"
            />
            <polygon points="-18,-6 -28,0 -18,6" fill="#ff5f6d" />
          </g>
        </svg>

        <div className="vector-controls">
          <label className="slider-control">
            <span>
              Flecha Amarilla (Velocidad Horizontal):{' '}
              <strong>{tangentialKmS.toFixed(2)} km/s</strong>
            </span>
            <input
              type="range"
              min="0.5"
              max="2.9"
              step="0.05"
              value={tangentialKmS}
              onChange={(e) => setTangentialKmS(Number(e.target.value))}
            />
          </label>

          <label className="slider-control">
            <span>
              Flecha Verde (Empuje hacia la Luna): <strong>{brakingKmS.toFixed(2)} km/s</strong>
            </span>
            <input
              type="range"
              min="0.1"
              max="1.4"
              step="0.05"
              value={brakingKmS}
              onChange={(e) => setBrakingKmS(Number(e.target.value))}
            />
          </label>
        </div>

        <div className={`trajectory-result ${trajectoryState.toLowerCase()}`}>
          <strong>{trajectoryTitle}</strong>
          <p>{trajectoryDesc}</p>
        </div>
      </div>
    </section>
  )
}
