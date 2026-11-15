import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import {
  AuthError,
  NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  EMAIL_MAX,
  isValidEmail,
  login,
  register,
  type AuthUser,
} from '../ephemeris/authApi.ts'

type Mode = 'login' | 'register'
type Lang = 'es' | 'en'

interface AuthScreenProps {
  initialMode?: Mode
  lang?: Lang
  onAuthenticated: (user: AuthUser) => void
  onClose: () => void
}

const T = {
  es: {
    loginTitle: 'Iniciar sesión',
    loginSub: 'Entra para guardar tus escenarios y comparaciones.',
    registerTitle: 'Crear cuenta',
    registerSub: 'Regístrate para explorar los sitios de alunizaje.',
    loginHeadline: 'Tu puerta de entrada a la Luna',
    registerHeadline: 'Únete a la misión',
    caption: 'Luz solar y visibilidad de la Tierra para elegir dónde y cuándo aterrizar.',
    name: 'Nombre',
    namePh: 'Tu nombre',
    email: 'Correo electrónico',
    emailPh: 'tu@correo.com',
    password: 'Contraseña',
    passwordPh: 'Tu contraseña',
    newPasswordPh: `Mínimo ${PASSWORD_MIN} caracteres`,
    confirm: 'Confirmar contraseña',
    confirmPh: 'Repite tu contraseña',
    forgot: '¿Olvidaste tu contraseña?',
    forgotNote:
      'Todavía no podemos enviar correos para cambiarla. Pide al equipo ORYSEL que restablezca tu cuenta o crea una nueva.',
    submitLogin: 'Iniciar sesión',
    submitRegister: 'Crear cuenta',
    busyLogin: 'Entrando…',
    busyRegister: 'Creando cuenta…',
    noAccount: '¿Aún no tienes cuenta?',
    toRegister: 'Regístrate',
    hasAccount: '¿Ya tienes cuenta?',
    toLogin: 'Inicia sesión',
    close: 'Cerrar',
    framed: 'Por seguridad, la cuenta no se usa dentro de otra página.',
    openTab: 'Abrir MOON DIAL en una pestaña nueva',
    errName: 'Escribe tu nombre.',
    errEmail: 'Escribe un correo válido, como tu@correo.com.',
    errPassword: `La contraseña necesita al menos ${PASSWORD_MIN} caracteres.`,
    errPasswordEmpty: 'Escribe tu contraseña.',
    errConfirm: 'Las contraseñas no coinciden.',
    credentials: 'Correo o contraseña incorrectos.',
    exists: 'Ya existe una cuenta con ese correo. Inicia sesión.',
    throttled: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
    network: 'No hay conexión con el servidor. Revisa tu internet y vuelve a intentarlo.',
    invalid: 'Revisa los datos del formulario.',
    server: 'El servidor no respondió bien. Vuelve a intentarlo en un momento.',
  },
  en: {
    loginTitle: 'Sign in',
    loginSub: 'Sign in to save your scenarios and comparisons.',
    registerTitle: 'Create account',
    registerSub: 'Sign up to explore the landing sites.',
    loginHeadline: 'Your gateway to the Moon',
    registerHeadline: 'Join the mission',
    caption: 'Sunlight and Earth visibility to choose where and when to land.',
    name: 'Name',
    namePh: 'Your name',
    email: 'Email',
    emailPh: 'you@email.com',
    password: 'Password',
    passwordPh: 'Your password',
    newPasswordPh: `At least ${PASSWORD_MIN} characters`,
    confirm: 'Confirm password',
    confirmPh: 'Repeat your password',
    forgot: 'Forgot your password?',
    forgotNote:
      "We can't send reset emails yet. Ask the ORYSEL team to reset your account, or create a new one.",
    submitLogin: 'Sign in',
    submitRegister: 'Create account',
    busyLogin: 'Signing in…',
    busyRegister: 'Creating account…',
    noAccount: "Don't have an account?",
    toRegister: 'Sign up',
    hasAccount: 'Already have an account?',
    toLogin: 'Sign in',
    close: 'Close',
    framed: "For your security, accounts can't be used inside another page.",
    openTab: 'Open MOON DIAL in a new tab',
    errName: 'Enter your name.',
    errEmail: 'Enter a valid email, like you@email.com.',
    errPassword: `Your password needs at least ${PASSWORD_MIN} characters.`,
    errPasswordEmpty: 'Enter your password.',
    errConfirm: "The passwords don't match.",
    credentials: 'Incorrect email or password.',
    exists: 'An account with that email already exists. Sign in instead.',
    throttled: 'Too many attempts. Wait a few minutes and try again.',
    network: 'No connection to the server. Check your internet and try again.',
    invalid: 'Check the form fields.',
    server: "The server didn't respond correctly. Try again in a moment.",
  },
} as const

type FieldErrors = Partial<Record<'name' | 'email' | 'password' | 'confirm', string>>

/* Fixed star field (same on every render) for the Moon panel. */
const STARS = (() => {
  let seed = 7
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  return Array.from({ length: 70 }, () => ({
    x: rand() * 744,
    y: rand() * 900,
    r: rand() < 0.85 ? 0.7 : 1.2,
    o: 0.25 + rand() * 0.5,
  }))
})()

/** Moon disk inside moon-real.jpg (1200 × 1200): centre (626.5, 586), radius 493. */
const MOON = { cx: 365, cy: 440, r: 218 }
const MOON_IMG = (() => {
  const s = MOON.r / 493
  return { size: 1200 * s, x: MOON.cx - 626.5 * s, y: MOON.cy - 586 * s }
})()

/**
 * Full-screen sign-in / sign-up page from the MOON DIAL Figma: the Moon with
 * the Earth and Sun on its orbit on the left, the form on the right. On
 * phones the Moon becomes a band above the form.
 */
export function AuthScreen({
  initialMode = 'login',
  lang = 'es',
  onAuthenticated,
  onClose,
}: AuthScreenProps) {
  const t = T[lang]
  const [mode, setMode] = useState<Mode>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [showForgot, setShowForgot] = useState(false)
  const [busy, setBusy] = useState(false)
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const ids = useId()

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [mode])

  const switchMode = (next: Mode) => {
    setMode(next)
    setErrors({})
    setFormError(null)
    setShowForgot(false)
    setPassword('')
    setConfirm('')
  }

  const validate = (): FieldErrors => {
    const next: FieldErrors = {}
    if (mode === 'register' && !name.trim()) next.name = t.errName
    if (!isValidEmail(email)) next.email = t.errEmail
    if (mode === 'register') {
      if (password.length < PASSWORD_MIN) next.password = t.errPassword
      if (confirm !== password) next.confirm = t.errConfirm
    } else if (!password) {
      next.password = t.errPasswordEmpty
    }
    return next
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const found = validate()
    setErrors(found)
    setFormError(null)
    if (Object.keys(found).length > 0) return
    setBusy(true)
    try {
      const user =
        mode === 'login' ? await login(email, password) : await register(name, email, password)
      setPassword('')
      setConfirm('')
      onAuthenticated(user)
    } catch (error) {
      const code = error instanceof AuthError ? error.code : 'server'
      setFormError(code === 'expired' ? t.credentials : t[code])
      setPassword('')
      setConfirm('')
    } finally {
      setBusy(false)
    }
  }

  const field = (key: keyof FieldErrors) => ({
    id: `${ids}-${key}`,
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `${ids}-${key}-err` : undefined,
  })

  const isLogin = mode === 'login'
  // Inside someone else's iframe a password form can be clickjacked or spoofed:
  // send the person to a real tab instead.
  const framed = (() => {
    if (typeof window === 'undefined' || window.self === window.top) return false
    try {
      return window.top?.location.origin !== window.location.origin
    } catch {
      return true // a cross-origin parent can't be read
    }
  })()

  return (
    <div className="auth-screen" role="dialog" aria-modal="true" aria-labelledby={`${ids}-title`}>
      <aside className="auth-visual" aria-hidden="true">
        <svg className="auth-visual-svg" viewBox="0 0 744 900" preserveAspectRatio="xMidYMid slice">
          <defs>
            <radialGradient id={`${ids}-sky`} cx="49%" cy="49%" r="70%">
              <stop offset="0%" stopColor="#13284a" />
              <stop offset="45%" stopColor="#0b1427" />
              <stop offset="100%" stopColor="#070a12" />
            </radialGradient>
            <radialGradient id={`${ids}-halo`} cx="50%" cy="50%" r="50%">
              <stop offset="70%" stopColor="#3b8cff" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#3b8cff" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${ids}-sun`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffd98a" />
              <stop offset="55%" stopColor="#f7b32b" />
              <stop offset="100%" stopColor="#f7b32b" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${ids}-earth`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#8cbbff" />
              <stop offset="60%" stopColor="#3b8cff" />
              <stop offset="100%" stopColor="#3b8cff" stopOpacity="0" />
            </radialGradient>
            {/* Warm tint so the grey photo reads like the colour Moon in the Figma */}
            <filter id={`${ids}-warm`} colorInterpolationFilters="sRGB">
              <feColorMatrix
                type="matrix"
                values="1.06 0.04 0 0 0.01  0.02 1.02 0.02 0 0.01  0 0.04 0.86 0 0  0 0 0 1 0"
              />
            </filter>
            <clipPath id={`${ids}-moon`}>
              <circle cx={MOON.cx} cy={MOON.cy} r={MOON.r} />
            </clipPath>
          </defs>
          <rect width="744" height="900" fill={`url(#${ids}-sky)`} />
          {STARS.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#ffffff" opacity={s.o} />
          ))}
          <circle cx={MOON.cx} cy={MOON.cy} r={MOON.r + 46} fill={`url(#${ids}-halo)`} />
          <circle
            cx={MOON.cx}
            cy={MOON.cy}
            r="286"
            fill="none"
            stroke="#8cbbff"
            strokeOpacity="0.22"
            strokeWidth="1.2"
          />
          <image
            href={`${import.meta.env.BASE_URL}moon-real.jpg`}
            x={MOON_IMG.x}
            y={MOON_IMG.y}
            width={MOON_IMG.size}
            height={MOON_IMG.size}
            clipPath={`url(#${ids}-moon)`}
            filter={`url(#${ids}-warm)`}
            preserveAspectRatio="none"
          />
          <circle cx="174" cy="268" r="22" fill={`url(#${ids}-earth)`} />
          <circle cx="174" cy="268" r="11" fill="#4fa2fe" />
          <circle cx="652" cy="447" r="26" fill={`url(#${ids}-sun)`} />
          <circle cx="652" cy="447" r="12" fill="#faac26" />
        </svg>

        <div className="auth-brand">
          MOON<span>DIAL</span>
        </div>

        <div className="auth-visual-copy">
          <p className="auth-eyebrow">NASA SPACE APPS 2026</p>
          <p className="auth-headline">{isLogin ? t.loginHeadline : t.registerHeadline}</p>
          <p className="auth-caption">{t.caption}</p>
        </div>
      </aside>

      <section className="auth-panel">
        <button type="button" className="auth-close" onClick={onClose} aria-label={t.close}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path
              d="M3 3l10 10M13 3L3 13"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {framed ? (
          <div className="auth-form">
            <h1 id={`${ids}-title`} className="auth-title">
              {isLogin ? t.loginTitle : t.registerTitle}
            </h1>
            <p className="auth-sub">{t.framed}</p>
            <a
              className="auth-submit auth-submit-link"
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.openTab}
            </a>
          </div>
        ) : (
          <form className="auth-form" onSubmit={onSubmit} noValidate>
            <h1 id={`${ids}-title`} className="auth-title">
              {isLogin ? t.loginTitle : t.registerTitle}
            </h1>
            <p className="auth-sub">{isLogin ? t.loginSub : t.registerSub}</p>

            {!isLogin && (
              <div className="auth-field">
                <label htmlFor={`${ids}-name`}>{t.name}</label>
                <input
                  ref={firstFieldRef}
                  {...field('name')}
                  type="text"
                  name="name"
                  autoComplete="name"
                  maxLength={NAME_MAX}
                  placeholder={t.namePh}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {errors.name && (
                  <p id={`${ids}-name-err`} className="auth-field-error">
                    {errors.name}
                  </p>
                )}
              </div>
            )}

            <div className="auth-field">
              <label htmlFor={`${ids}-email`}>{t.email}</label>
              <input
                ref={isLogin ? firstFieldRef : undefined}
                {...field('email')}
                type="email"
                name="email"
                inputMode="email"
                autoComplete={isLogin ? 'username' : 'email'}
                autoCapitalize="none"
                spellCheck={false}
                maxLength={EMAIL_MAX}
                placeholder={t.emailPh}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {errors.email && (
                <p id={`${ids}-email-err`} className="auth-field-error">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="auth-field">
              <label htmlFor={`${ids}-password`}>{t.password}</label>
              <input
                {...field('password')}
                type="password"
                name="password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                minLength={isLogin ? undefined : PASSWORD_MIN}
                maxLength={PASSWORD_MAX}
                placeholder={isLogin ? t.passwordPh : t.newPasswordPh}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {errors.password && (
                <p id={`${ids}-password-err`} className="auth-field-error">
                  {errors.password}
                </p>
              )}
            </div>

            {!isLogin && (
              <div className="auth-field">
                <label htmlFor={`${ids}-confirm`}>{t.confirm}</label>
                <input
                  {...field('confirm')}
                  type="password"
                  name="confirm"
                  autoComplete="new-password"
                  maxLength={PASSWORD_MAX}
                  placeholder={t.confirmPh}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                {errors.confirm && (
                  <p id={`${ids}-confirm-err`} className="auth-field-error">
                    {errors.confirm}
                  </p>
                )}
              </div>
            )}

            {isLogin && (
              <div className="auth-forgot-row">
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => setShowForgot((v) => !v)}
                >
                  {t.forgot}
                </button>
              </div>
            )}
            {isLogin && showForgot && <p className="auth-note">{t.forgotNote}</p>}

            {formError && (
              <p className="auth-form-error" role="alert">
                {formError}
              </p>
            )}

            <button type="submit" className="auth-submit" disabled={busy} aria-busy={busy}>
              {busy
                ? isLogin
                  ? t.busyLogin
                  : t.busyRegister
                : isLogin
                  ? t.submitLogin
                  : t.submitRegister}
            </button>

            <p className="auth-switch">
              {isLogin ? t.noAccount : t.hasAccount}{' '}
              <button
                type="button"
                className="auth-link"
                onClick={() => switchMode(isLogin ? 'register' : 'login')}
              >
                {isLogin ? t.toRegister : t.toLogin}
              </button>
            </p>
          </form>
        )}
      </section>
    </div>
  )
}
