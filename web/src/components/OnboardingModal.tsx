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
  lang?: 'es' | 'en'
}

export function OnboardingModal({
  session,
  onComplete,
  onClose,
  lang = 'es',
}: OnboardingModalProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register')
  const [name, setName] = useState(session.name)
  const [email, setEmail] = useState('explorador@orysel.space')
  const [password, setPassword] = useState('••••••••')
  const [organization, setOrganization] = useState(session.organization)
  const [profile, setProfile] = useState<UserProfileMode>(session.profile)

  const moonUrl = `${import.meta.env.BASE_URL}moon-real.jpg`
  const rMoon = 74
  const imgSize = 1200 * (rMoon / 493)
  const imgX = 140 - 626.5 * (rMoon / 493)
  const imgY = 140 - 586.0 * (rMoon / 493)

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="md-auth-split-card">
        {/* Left Visual Column with Real Photographic Moon (Exact match to dc_moons.pdf) */}
        <div className="md-auth-left">
          <div className="md-auth-brand">
            <strong>MOON</strong> <span className="md-brand-accent">DIAL</span>
          </div>

          <div className="md-auth-moon-stage">
            <svg viewBox="0 0 280 280" className="md-auth-moon-svg" aria-hidden="true">
              <defs>
                <clipPath id="authMoonClip">
                  <circle cx="140" cy="140" r={rMoon} />
                </clipPath>
                <radialGradient id="authMoonGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#3B8CFF" stopOpacity="0.35" />
                  <stop offset="70%" stopColor="#3B8CFF" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#3B8CFF" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle
                cx="140"
                cy="140"
                r="112"
                fill="none"
                stroke="rgba(140, 187, 255, 0.22)"
                strokeWidth="1.2"
              />
              <circle cx="140" cy="140" r={rMoon + 18} fill="url(#authMoonGlow)" />
              <g clipPath="url(#authMoonClip)">
                <image
                  href={moonUrl}
                  x={imgX}
                  y={imgY}
                  width={imgSize}
                  height={imgSize}
                  preserveAspectRatio="none"
                />
              </g>
              <circle cx="58" cy="64" r="7" fill="#3B8CFF" />
              <circle cx="248" cy="152" r="8.5" fill="#F7B32B" />
            </svg>
          </div>

          <div className="md-auth-left-Copy">
            <span className="md-eyebrow">NASA SPACE APPS 2026</span>
            <h3>
              {authMode === 'login'
                ? lang === 'es'
                  ? 'Tu puerta de entrada a la Luna'
                  : 'Your gateway to the Moon'
                : lang === 'es'
                  ? 'Únete a la misión'
                  : 'Join the mission'}
            </h3>
            <p className="md-caption">
              {lang === 'es'
                ? 'Luz solar y visibilidad de la Tierra para elegir dónde y cuándo aterrizar.'
                : 'Sunlight and Earth visibility to choose where and when to land.'}
            </p>
          </div>
        </div>

        {/* Right Form Column */}
        <div className="md-auth-right">
          <div className="md-auth-right-top">
            <div>
              <h2 id="modal-title" className="md-h1">
                {authMode === 'login'
                  ? lang === 'es'
                    ? 'Iniciar sesión'
                    : 'Sign in'
                  : lang === 'es'
                    ? 'Crear cuenta'
                    : 'Create account'}
              </h2>
              <p className="md-caption">
                {authMode === 'login'
                  ? lang === 'es'
                    ? 'Entra para guardar tus escenarios y comparaciones.'
                    : 'Sign in to save your scenarios and comparisons.'
                  : lang === 'es'
                    ? 'Regístrate para explorar los sitios de alunizaje según tu perfil.'
                    : 'Register to explore landing sites tailored to your audience profile.'}
              </p>
            </div>
            <button
              type="button"
              className="md-close-icon-btn"
              onClick={onClose}
              aria-label={lang === 'es' ? 'Cerrar' : 'Close'}
            >
              ✕
            </button>
          </div>

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
            {authMode === 'register' && (
              <div className="form-row-2">
                <label className="field">
                  <span>{lang === 'es' ? 'Nombre' : 'Name'}</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={lang === 'es' ? 'Tu nombre' : 'Your name'}
                    required
                  />
                </label>

                <label className="field">
                  <span>{lang === 'es' ? 'Institución / Agencia' : 'Organization'}</span>
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="NASA Space Apps"
                  />
                </label>
              </div>
            )}

            <div className="form-row-2">
              <label className="field">
                <span>{lang === 'es' ? 'Correo electrónico' : 'Email address'}</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  required
                />
              </label>

              <label className="field">
                <span>{lang === 'es' ? 'Contraseña' : 'Password'}</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </label>
            </div>

            <div className="field">
              <span>
                {lang === 'es' ? 'Perfil de visualización' : 'Audience visualization mode'}
              </span>
              <div className="profile-grid">
                <button
                  type="button"
                  className={`profile-option ${profile === 'professional' ? 'active' : ''}`}
                  onClick={() => setProfile('professional')}
                >
                  <strong>
                    {lang === 'es' ? 'Especialista (NASA / SPICE)' : 'Specialist (NASA / SPICE)'}
                  </strong>
                  <small>
                    {lang === 'es'
                      ? 'Métricas completas, efemérides topocéntricas y tabla AWS PostgreSQL.'
                      : 'Full metrics, topocentric ephemerides and live AWS PostgreSQL table.'}
                  </small>
                </button>

                <button
                  type="button"
                  className={`profile-option ${profile === 'executive' ? 'active' : ''}`}
                  onClick={() => setProfile('executive')}
                >
                  <strong>
                    {lang === 'es' ? 'General (KPI Ejecutivo)' : 'General (Executive KPI)'}
                  </strong>
                  <small>
                    {lang === 'es'
                      ? 'KPI consolidado (GO / NO-GO), enlace Tierra y resumen visual.'
                      : 'Consolidated KPI (GO / NO-GO), Earth link and visual summary.'}
                  </small>
                </button>

                <button
                  type="button"
                  className={`profile-option ${profile === 'educational' ? 'active' : ''}`}
                  onClick={() => setProfile('educational')}
                >
                  <strong>
                    {lang === 'es' ? 'Educador (Divulgación)' : 'Educator (Outreach)'}
                  </strong>
                  <small>
                    {lang === 'es'
                      ? 'Tarjetas didácticas de acimut, libración, Reiner Gamma y Luna vs. Tierra.'
                      : 'Didactic cards on azimuth, libration, Reiner Gamma and Moon vs. Earth.'}
                  </small>
                </button>

                <button
                  type="button"
                  className={`profile-option ${profile === 'kids' ? 'active' : ''}`}
                  onClick={() => setProfile('kids')}
                >
                  <strong>
                    {lang === 'es' ? 'Infantil (Exploradores)' : 'Kids (Young Explorers)'}
                  </strong>
                  <small>
                    {lang === 'es'
                      ? 'Explicación amigable sin saturación de datos y simulador de cohete.'
                      : 'Friendly explanation without data overload and rocket simulator.'}
                  </small>
                </button>
              </div>
            </div>

            <button type="submit" className="md-auth-submit-btn">
              {authMode === 'login'
                ? lang === 'es'
                  ? 'Iniciar sesión'
                  : 'Sign in'
                : lang === 'es'
                  ? 'Crear cuenta'
                  : 'Create account'}
            </button>

            <div className="md-auth-switch-line">
              {authMode === 'login' ? (
                <span>
                  {lang === 'es' ? '¿Aún no tienes cuenta? ' : "Don't have an account? "}
                  <button type="button" onClick={() => setAuthMode('register')}>
                    {lang === 'es' ? 'Regístrate' : 'Create account'}
                  </button>
                </span>
              ) : (
                <span>
                  {lang === 'es' ? '¿Ya tienes cuenta? ' : 'Already have an account? '}
                  <button type="button" onClick={() => setAuthMode('login')}>
                    {lang === 'es' ? 'Inicia sesión' : 'Sign in'}
                  </button>
                </span>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
