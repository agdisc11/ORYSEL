import { useState } from 'react'
import type { UserProfileMode } from '../ephemeris/types.ts'

export interface UserSession {
  name: string
  organization: string
  profile: UserProfileMode
}

interface OnboardingModalProps {
  session: UserSession | null
  onComplete: (session: UserSession) => void
  onClose: () => void
}

export function OnboardingModal({ session, onComplete, onClose }: OnboardingModalProps) {
  const [name, setName] = useState(session?.name ?? 'Cmdr. Leonardo · Equipo ORYSEL')
  const [organization, setOrganization] = useState(
    session?.organization ?? 'Agencia Espacial / NASA Space Apps',
  )
  const [profile, setProfile] = useState<UserProfileMode>(session?.profile ?? 'professional')

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-card">
        <div className="modal-header">
          <span className="pill-badge">PASO 1 · REGISTRO DE CUENTA Y PERFIL</span>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <h2 id="modal-title">Crear Cuenta de Misión en ORYSEL</h2>
        <p className="muted">
          Personaliza la interfaz según tu nivel: ORYSEL adapta el mismo cálculo físico SPICE/DE440
          para ingenieros aeroespaciales, docentes universitarios o niños exploradores.
        </p>

        <form
          className="onboarding-form"
          onSubmit={(e) => {
            e.preventDefault()
            onComplete({
              name: name.trim() || 'Explorador ORYSEL',
              organization: organization.trim() || 'Misión Lunar',
              profile,
            })
          }}
        >
          <label className="field">
            <span>Nombre de usuario o comandante</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Dra. Elena Vance"
              required
            />
          </label>

          <label className="field">
            <span>Institución / Centro / Escuela</span>
            <input
              type="text"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="Ej. NASA Artemis / Universidad / Primaria"
            />
          </label>

          <div className="field">
            <span>Selecciona tu segmento de interfaz</span>
            <div className="profile-grid">
              <button
                type="button"
                className={`profile-option ${profile === 'professional' ? 'active' : ''}`}
                onClick={() => setProfile('professional')}
              >
                <strong>1. Profesional (NASA)</strong>
                <small>Mecánica orbital, ángulos acimutales, velocidades y telemetría LoS.</small>
              </button>
              <button
                type="button"
                className={`profile-option ${profile === 'educational' ? 'active' : ''}`}
                onClick={() => setProfile('educational')}
              >
                <strong>2. Educativa</strong>
                <small>Explicación visual e interactiva de parámetros orbitales sin saturación.</small>
              </button>
              <button
                type="button"
                className={`profile-option ${profile === 'kids' ? 'active' : ''}`}
                onClick={() => setProfile('kids')}
              >
                <strong>3. Infantil / Gamificada</strong>
                <small>Veredicto "¡Sí se puede!" y simulador de flechas vectoriales del cohete.</small>
              </button>
            </div>
          </div>

          <div className="modal-actions">
            <button type="submit" className="btn-primary">
              Activar Cuenta e Iniciar Recorrido →
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
