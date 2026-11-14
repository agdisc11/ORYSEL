import type { Sample, Site, UserProfileMode, ViabilityKPI } from '../ephemeris/types.ts'

interface OryBotAssistantProps {
  site: Site
  viability: ViabilityKPI
  profile: UserProfileMode
  activeSample: Sample
  userName: string
  onSelectSiteId: (id: string) => void
}

export function OryBotAssistant({
  site,
  viability,
  profile,
  activeSample,
  userName,
  onSelectSiteId,
}: OryBotAssistantProps) {
  const getBotMessage = () => {
    if (profile === 'kids') {
      if (viability.isViable) {
        return `¡Hola ${userName}! Analicé ${site.name} con mis sensores de la NASA y ¡SÍ SE PUEDE ALUNIZAR! Tenemos luz del Sol para nuestras baterías y vemos la Tierra y el satélite cámara sin que ninguna montaña nos tape.`
      }
      return `¡Cuidado ${userName}! En ${site.name} NO SE PUEDE alunizar. Las paredes gigantes del cráter tapan nuestra antena con la Tierra y dejan al satélite en un punto ciego sin poder tomarnos fotos. ¡Mejor viajemos a Reiner Gamma!`
    }

    if (profile === 'educational') {
      if (viability.blindSpotDetected) {
        return `Diagnóstico pedagógico para ${site.name}: Aunque existen breves periodos de luz solar, la muralla topográfica del cráter bloquea la Línea de Visión (LoS) con la Tierra y con el satélite orbital. En una misión real, perder el enlace o quedar en punto ciego fotográfico obliga a descartar el sitio.`
      }
      return `Explorando ${site.name}: En este instante el Sol está a ${activeSample.sun_el.toFixed(1)}° sobre el horizonte (acimut ${activeSample.sun_az.toFixed(1)}°) y la Tierra a ${activeSample.earth_el.toFixed(1)}°. Esto garantiza energía solar y comunicación continua sin puntos ciegos.`
    }

    // Professional mode
    if (viability.blindSpotDetected) {
      return `ALERTA DE VETO OPERACIONAL (${site.name}): KPI penalizado al ${viability.scorePct}% [NO-GO]. ${viability.vetoReason} Se recomienda reasignar vector de inserción hacia Reiner Gamma (7.48°N, 59.05°W) o meseta Mons Mouton (IM-2).`
    }
    return `Dictamen Nominal (${site.name}): KPI de Viabilidad en ${viability.scorePct}% [${viability.verdict}]. Enlace directo Tierra-Tripulación verificado y Línea de Visión (LoS) libre para confirmación fotográfica orbital. Acimut de aproximación recomendado: ${viability.kinematics.optimalApproachAzimuthDeg}° (v_orb = ${viability.kinematics.orbitalVelocityKmS} km/s).`
  }

  return (
    <aside className={`orybot-card ${viability.blindSpotDetected ? 'alert' : 'ok'}`} aria-label="Asistente virtual ORY-Bot">
      <div className="orybot-avatar" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="54" height="54">
          <line x1="32" y1="4" x2="32" y2="14" stroke="currentColor" strokeWidth="3" />
          <circle
            cx="32"
            cy="4"
            r="4"
            fill={viability.blindSpotDetected ? '#ff5f6d' : '#4ce0b3'}
          />
          <rect x="12" y="14" width="40" height="34" rx="10" fill="#1b2434" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="24" cy="29" r="5" fill={viability.blindSpotDetected ? '#ff8f8f' : '#5fa8f5'} />
          <circle cx="40" cy="29" r="5" fill={viability.blindSpotDetected ? '#ff8f8f' : '#5fa8f5'} />
          <path
            d={viability.blindSpotDetected ? 'M23 41 Q32 35 41 41' : 'M22 38 Q32 45 42 38'}
            stroke="#f2b53a"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
          <rect x="6" y="25" width="5" height="12" rx="2" fill="currentColor" />
          <rect x="53" y="25" width="5" height="12" rx="2" fill="currentColor" />
        </svg>
      </div>

      <div className="orybot-body">
        <div className="orybot-header">
          <span className="pill-badge">PASO 3 · ASISTENTE VIRTUAL ORY-BOT</span>
          <span className="mono muted">
            Modo: {profile === 'professional' ? 'NASA / Orbital' : profile === 'educational' ? 'Educativo' : 'Infantil'}
          </span>
        </div>
        <p className="orybot-speech">{getBotMessage()}</p>

        <div className="orybot-quick-actions">
          {site.id !== 'reiner-gamma' && (
            <button
              type="button"
              className="btn-chip"
              onClick={() => onSelectSiteId('reiner-gamma')}
            >
              Ir a Reiner Gamma (Sitio Óptimo · 28 nT)
            </button>
          )}
          {site.id !== 'im2' && (
            <button type="button" className="btn-chip" onClick={() => onSelectSiteId('im2')}>
              Ver Misión IM-2 (Mons Mouton)
            </button>
          )}
          {site.id !== 'shackleton-blindspot' && (
            <button
              type="button"
              className="btn-chip danger"
              onClick={() => onSelectSiteId('shackleton-blindspot')}
            >
              Simular Punto Ciego (Cráter Shackleton)
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
