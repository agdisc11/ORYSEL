import { useState } from 'react'
import type { Sample, Site, UserProfileMode, ViabilityKPI } from '../ephemeris/types.ts'

interface OryBotAssistantProps {
  site: Site
  viability: ViabilityKPI
  profile: UserProfileMode
  activeSample: Sample
  userName: string
  onSelectSiteId: (id: string) => void
  lang?: 'es' | 'en'
}

/**
 * Floating collapsible virtual assistant widget ("ORY-Bot / Robotito") anchored
 * in the bottom-right corner so it never clutters the main Mission Control canvas.
 */
export function OryBotAssistant({
  site,
  viability,
  profile,
  activeSample,
  userName,
  onSelectSiteId,
  lang = 'es',
}: OryBotAssistantProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false)

  const getBotMessage = () => {
    if (profile === 'kids') {
      if (viability.isViable) {
        return lang === 'es'
          ? `¡Hola ${userName}! Mis sensores de la NASA revisaron ${site.name} y ¡SÍ SE PUEDE ATERRIZAR! Tenemos luz del Sol para nuestras baterías y línea de vista limpia con la Tierra y con el satélite cámara.`
          : `Hi ${userName}! My NASA sensors checked ${site.name} and YES, WE CAN LAND! We have sunlight for our batteries and a clear line of sight to Earth and the camera satellite.`
      }
      return lang === 'es'
        ? `¡Alerta ${userName}! En ${site.name} ¡NO SE PUEDE ATERRIZAR! Las paredes del cráter tapan la señal con los astronautas y dejan al satélite en punto ciego. ¡Cambiemos a Reiner Gamma!`
        : `Alert ${userName}! At ${site.name} WE CANNOT LAND! The crater walls block the radio signal with the astronauts and leave the satellite in a blind spot. Let's switch to Reiner Gamma!`
    }

    if (profile === 'educational') {
      if (viability.blindSpotDetected) {
        return lang === 'es'
          ? `Guía Educativa (${site.name}): La muralla del cráter (~11° de altura aparente) bloquea la Línea de Visión (LoS) con la Tierra y con el orbitador. Sin telemetría ni confirmación fotográfica, el sitio se descarta.`
          : `Educator Guide (${site.name}): The crater rim (~11° apparent height) blocks the Line of Sight (LoS) to Earth and the orbiter. Without telemetry or photographic confirmation, the site is ruled out.`
      }
      return lang === 'es'
        ? `Guía Educativa (${site.name}): En este instante el Sol está a ${activeSample.sun_el.toFixed(1)}° (Az ${activeSample.sun_az.toFixed(1)}°) y la Tierra a ${activeSample.earth_el.toFixed(1)}°, manteniendo energía y radio continuos.`
        : `Educator Guide (${site.name}): Right now the Sun is at ${activeSample.sun_el.toFixed(1)}° (Az ${activeSample.sun_az.toFixed(1)}°) and Earth at ${activeSample.earth_el.toFixed(1)}°, maintaining continuous power and radio.`
    }

    if (viability.blindSpotDetected) {
      return lang === 'es'
        ? `VETO DE COMUNICACIÓN (${site.name}): KPI penalizado a ${viability.scorePct}% [NO-GO]. ${viability.vetoReason} Te sugiero conmutar a Reiner Gamma (96% GO) o IM-2 Mons Mouton (85% GO).`
        : `COMMUNICATION VETO (${site.name}): KPI penalized to ${viability.scorePct}% [NO-GO]. Craggy crater walls block direct line-of-sight with Earth and orbital confirmation. Try Reiner Gamma (96% GO) or IM-2 Mons Mouton (85% GO).`
    }

    return lang === 'es'
      ? `Diagnóstico ORY-Bot (${site.name}): KPI consolidado en ${viability.scorePct}% [${viability.verdict}]. Enlace directo Tierra-Tripulación activo y pase orbital libre de puntos ciegos. Acimut óptimo de descenso: ${viability.kinematics.optimalApproachAzimuthDeg}°.`
      : `ORY-Bot Diagnostics (${site.name}): Consolidated KPI at ${viability.scorePct}% [${viability.verdict}]. Direct Earth-Crew link active and orbital pass free of blind spots. Optimal approach azimuth: ${viability.kinematics.optimalApproachAzimuthDeg}°.`
  }

  return (
    <div className="orybot-floating-wrap" aria-live="polite">
      {isOpen ? (
        <aside
          className={`orybot-drawer ${viability.blindSpotDetected ? 'alert' : 'ok'}`}
          aria-label={lang === 'es' ? 'Asistente virtual ORY-Bot' : 'ORY-Bot virtual assistant'}
        >
          <div className="orybot-drawer-top">
            <div className="orybot-title-group">
              <span className="orybot-dot" />
              <strong>
                {lang === 'es' ? 'ORY-Bot · Asistente de Viabilidad' : 'ORY-Bot · Viability Assistant'}
              </strong>
              <span className="tag-mini ok">{viability.scorePct}% KPI</span>
            </div>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => setIsOpen(false)}
              aria-label={lang === 'es' ? 'Minimizar asistente' : 'Minimize assistant'}
            >
              {lang === 'es' ? 'Minimizar —' : 'Minimize —'}
            </button>
          </div>

          <p className="orybot-speech">{getBotMessage()}</p>

          <div className="orybot-quick-actions">
            {site.id !== 'reiner-gamma' && (
              <button
                type="button"
                className="btn-chip"
                onClick={() => onSelectSiteId('reiner-gamma')}
              >
                Reiner Gamma (96% GO)
              </button>
            )}
            {site.id !== 'im2' && (
              <button type="button" className="btn-chip" onClick={() => onSelectSiteId('im2')}>
                IM-2 Mons Mouton (85% GO)
              </button>
            )}
            {site.id !== 'shackleton-blindspot' && (
              <button
                type="button"
                className="btn-chip danger"
                onClick={() => onSelectSiteId('shackleton-blindspot')}
              >
                {lang === 'es' ? 'Probar Punto Ciego (Shackleton)' : 'Test Blind Spot (Shackleton)'}
              </button>
            )}
          </div>
        </aside>
      ) : (
        <button
          type="button"
          className={`orybot-fab ${viability.blindSpotDetected ? 'alert' : 'ok'}`}
          onClick={() => setIsOpen(true)}
          aria-label={lang === 'es' ? 'Abrir asistente virtual ORY-Bot' : 'Open ORY-Bot assistant'}
        >
          <svg viewBox="0 0 64 64" width="28" height="28" aria-hidden="true">
            <line x1="32" y1="4" x2="32" y2="14" stroke="currentColor" strokeWidth="4" />
            <circle
              cx="32"
              cy="4"
              r="4.5"
              fill={viability.blindSpotDetected ? '#ff5f6d' : '#4ce0b3'}
            />
            <rect
              x="12"
              y="14"
              width="40"
              height="34"
              rx="10"
              fill="#131924"
              stroke="currentColor"
              strokeWidth="3"
            />
            <circle cx="24" cy="29" r="4.5" fill="#5fa8f5" />
            <circle cx="40" cy="29" r="4.5" fill="#5fa8f5" />
            <path
              d={viability.blindSpotDetected ? 'M23 41 Q32 35 41 41' : 'M22 38 Q32 45 42 38'}
              stroke="#f2b53a"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
          <div className="orybot-fab-text">
            <strong>{lang === 'es' ? 'ORY-Bot Asistente' : 'ORY-Bot Assistant'}</strong>
            <span>
              {viability.blindSpotDetected
                ? lang === 'es'
                  ? '¡Alerta de Punto Ciego!'
                  : 'Blind Spot Alert!'
                : lang === 'es'
                  ? `KPI ${viability.scorePct}% · Consultar`
                  : `KPI ${viability.scorePct}% · Ask`}
            </span>
          </div>
        </button>
      )}
    </div>
  )
}
