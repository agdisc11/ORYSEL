import { useState } from 'react'
import type { UserProfileMode } from '../ephemeris/types.ts'

export interface UserSession {
  name: string
  organization: string
  profile: UserProfileMode
}

interface OnboardingModalProps {
  session: UserSession
  onComplete: (session: UserSession) => void
  onClose: () => void
}

export function OnboardingModal({ session, onComplete, onClose }: OnboardingModalProps) {
  const [name, setName] = useState(session.name)
  const [organization, setOrganization] = useState(session.organization)
  const [profile, setProfile] = useState<UserProfileMode>(session.profile)

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-card">
        <div className="modal-header">
          <span className="pill-badge">PASO 1 · REGISTRO DE CUENTA Y AUDIENCIA</span>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <h2 id="modal-title">Configuración de Cuenta · ORYSEL Mission Control</h2>
        <p className="muted">
          Selecciona tu perfil para adaptar la vista: ORYSEL presenta una sola vista limpia a la
          vez según el tipo de decisión que necesitas tomar.
        </p>

        <form
          className="onboarding-form"
          onSubmit={(e) => {
            e.preventDefault()
            onComplete({
              name: name.trim() || 'Cmdr. ORYSEL',
              organization: organization.trim() || 'NASA Space Apps',
              profile,
            })
          }}
        >
          <div className="form-row-2">
            <label className="field">
              <span>Nombre / Comandante</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Cmdr. Leonardo"
                required
              />
            </label>

            <label className="field">
              <span>Institución / Agencia</span>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="Ej. NASA Space Apps · UP Chiapas"
              />
            </label>
          </div>

          <div className="field">
            <span>Vista predeterminada por audiencia</span>
            <div className="profile-grid">
              <button
                type="button"
                className={`profile-option ${profile === 'executive' ? 'active' : ''}`}
                onClick={() => setProfile('executive')}
              >
                <strong>1. Vista Ejecutiva (KPI & Toma de Decisiones)</strong>
                <small>
                  Veredicto GO/NO-GO, comparativa AWS PostgreSQL y riesgos ambientales lunares.
                </small>
              </button>
              <button
                type="button"
                className={`profile-option ${profile === 'professional' ? 'active' : ''}`}
                onClick={() => setProfile('professional')}
              >
                <strong>2. Vista Profesional (Especialistas NASA / Mecánica Orbital)</strong>
                <small>
                  Curvas de elevación, velocidades de escape, serie JPL Horizons AWS y SpaceEngine.
                </small>
              </button>
              <button
                type="button"
                className={`profile-option ${profile === 'educational' ? 'active' : ''}`}
                onClick={() => setProfile('educational')}
              >
                <strong>3. Vista Educativa (Estudiantes / Divulgación)</strong>
                <small>
                  Explicación visual e interactiva de parámetros orbitales y clima espacial.
                </small>
              </button>
              <button
                type="button"
                className={`profile-option ${profile === 'kids' ? 'active' : ''}`}
                onClick={() => setProfile('kids')}
              >
                <strong>4. Vista Infantil / Gamificada</strong>
                <small>
                  Veredicto binario gigante ("¡Sí se puede!") y simulador de vectores en cohete.
                </small>
              </button>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Guardar Perfil e Ir al Tablero →
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
