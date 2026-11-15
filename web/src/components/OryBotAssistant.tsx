import { useState } from 'react'
import type { Sample, Site, UserProfileMode, ViabilityKPI } from '../ephemeris/types.ts'

/** Score of another catalog site, so the quick buttons show live values. */
export interface SiteScore {
  id: string
  name: string
  score: number
  verdict: ViabilityKPI['verdict']
}

interface OryBotAssistantProps {
  site: Site
  viability: ViabilityKPI
  profile: UserProfileMode
  activeSample: Sample
  userName: string
  /** Other sites with their computed KPI (from the loaded reports). */
  otherSites: SiteScore[]
  onSelectSiteId: (id: string) => void
  lang?: 'es' | 'en'
}

const shortName = (name: string) => name.replace(/\s*\(.*\)\s*$/, '')

/**
 * ORY-Bot: a guide that reads the current site's computed data and explains it
 * for the selected audience. It is rule-based (no AI, no free text): every
 * number it says comes from the SPICE report or from the team's model.
 */
export function OryBotAssistant({
  site,
  viability,
  profile,
  activeSample,
  userName,
  otherSites,
  onSelectSiteId,
  lang = 'es',
}: OryBotAssistantProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const es = lang === 'es'
  const assumedHorizon = site.horizonSource === 'supuesto'
  const best = [...otherSites]
    .filter((s) => s.verdict === 'GO')
    .sort((a, b) => b.score - a.score)[0]
  const sunNow = `${activeSample.sun_el.toFixed(1)}°`
  const earthNow = `${activeSample.earth_el.toFixed(1)}°`

  const getBotMessage = () => {
    if (profile === 'kids') {
      if (viability.isViable) {
        return es
          ? `¡Hola ${userName}! Revisé ${shortName(site.name)}: hay luz del Sol para las baterías y la Tierra se ve en el cielo para hablar por radio. ¡Parece un buen lugar!`
          : `Hi ${userName}! I checked ${shortName(site.name)}: there is sunlight for the batteries and Earth is in the sky for radio. It looks like a good place!`
      }
      return es
        ? `¡Cuidado, ${userName}! En ${shortName(site.name)} casi no se ve la Tierra ni el Sol${assumedHorizon ? ' (en este ejemplo imaginamos paredes de cráter altas)' : ''}. Sin radio no podríamos avisar que llegamos.${best ? ` Mejor probemos ${shortName(best.name)}.` : ''}`
        : `Careful, ${userName}! At ${shortName(site.name)} we can hardly see Earth or the Sun${assumedHorizon ? ' (in this example we imagine tall crater walls)' : ''}. Without radio we could not say we arrived.${best ? ` Let's try ${shortName(best.name)}.` : ''}`
    }

    if (profile === 'educational') {
      if (viability.blindSpotDetected) {
        return es
          ? `${shortName(site.name)}: ${assumedHorizon ? 'con el horizonte supuesto de 8° a 12°, ' : ''}la Tierra no sube lo suficiente sobre el horizonte. Sin línea de visión no hay radio directa, y el modelo descarta el sitio.`
          : `${shortName(site.name)}: ${assumedHorizon ? 'with the assumed 8°–12° horizon, ' : ''}Earth does not rise far enough above the horizon. Without line of sight there is no direct radio, so the model rules the site out.`
      }
      return es
        ? `${shortName(site.name)}, en este instante: el Sol está a ${sunNow} (acimut ${activeSample.sun_az.toFixed(1)}°) y la Tierra a ${earthNow}. Si un valor es negativo, ese astro está bajo el horizonte.`
        : `${shortName(site.name)}, right now: the Sun is at ${sunNow} (azimuth ${activeSample.sun_az.toFixed(1)}°) and Earth at ${earthNow}. A negative value means it is below the horizon.`
    }

    if (viability.blindSpotDetected) {
      return es
        ? `Veto de comunicación en ${shortName(site.name)}: KPI ${viability.scorePct}% [NO-GO]. ${viability.vetoReason ?? ''}${best ? ` Alternativa con mejor puntaje: ${shortName(best.name)} (${best.score}%).` : ''}`
        : `Communication veto at ${shortName(site.name)}: KPI ${viability.scorePct}% [NO-GO]. Earth does not clear the horizon enough for a direct link.${best ? ` Best alternative: ${shortName(best.name)} (${best.score}%).` : ''}`
    }
    return es
      ? `${shortName(site.name)}: KPI ${viability.scorePct}% [${viability.verdict}]. En este instante el Sol está a ${sunNow} y la Tierra a ${earthNow}. El KPI es un modelo del equipo; los ángulos salen de SPICE DE440.`
      : `${shortName(site.name)}: KPI ${viability.scorePct}% [${viability.verdict}]. Right now the Sun is at ${sunNow} and Earth at ${earthNow}. The KPI is the team's model; the angles come from SPICE DE440.`
  }

  return (
    <div className="orybot-floating-wrap" aria-live="polite">
      {isOpen ? (
        <aside
          className={`orybot-drawer ${viability.blindSpotDetected ? 'alert' : 'ok'}`}
          aria-label={es ? 'Asistente virtual ORY-Bot' : 'ORY-Bot virtual assistant'}
        >
          <div className="orybot-drawer-top">
            <div className="orybot-title-group">
              <span className="orybot-dot" />
              <strong>{es ? 'ORY-Bot · Guía del sitio' : 'ORY-Bot · Site guide'}</strong>
              <span className="tag-mini ok">{viability.scorePct}% KPI</span>
            </div>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => setIsOpen(false)}
              aria-label={es ? 'Minimizar asistente' : 'Minimize assistant'}
            >
              {es ? 'Minimizar —' : 'Minimize —'}
            </button>
          </div>

          <p className="orybot-speech">{getBotMessage()}</p>

          <div className="orybot-quick-actions">
            {otherSites.map((s) => (
              <button
                key={s.id}
                type="button"
                className={s.verdict === 'GO' ? 'btn-chip' : 'btn-chip danger'}
                onClick={() => onSelectSiteId(s.id)}
              >
                {shortName(s.name)} ({s.score}%{' '}
                {s.verdict === 'GO' ? 'GO' : s.verdict === 'CAUTION' ? 'CAUTION' : 'NO-GO'})
              </button>
            ))}
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
