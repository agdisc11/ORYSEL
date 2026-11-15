import { useCallback, useEffect, useState } from 'react'
import App from './App.tsx'
import { AuthScreen } from './components/AuthScreen.tsx'
import {
  SESSION_EXPIRED_EVENT,
  logout,
  restoreSession,
  type AuthUser,
} from './ephemeris/authApi.ts'

type Lang = 'es' | 'en'

/** Language last chosen in the app, else the browser's. */
const browserLang = (): Lang => {
  try {
    const saved = localStorage.getItem('orysel.lang')
    if (saved === 'es' || saved === 'en') return saved
  } catch {
    // no storage: fall back to the browser language
  }
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('en')
    ? 'en'
    : 'es'
}

const EXPIRED_NOTICE: Record<Lang, string> = {
  es: 'Tu sesión terminó. Vuelve a iniciar sesión para seguir.',
  en: 'Your session ended. Sign in again to continue.',
}

/**
 * An account is required to use MOON DIAL: nothing of the app is rendered
 * (and no data is requested) until the server confirms the session.
 */
export function AuthGate() {
  const lang = browserLang() // re-read on every render: sign-out shows the language last chosen in the app
  const [user, setUser] = useState<AuthUser | null>(null)
  const [checking, setChecking] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    restoreSession().then((restored) => {
      if (!alive) return
      setUser(restored)
      setChecking(false)
    })
    const onExpired = () => {
      setUser(null)
      setNotice(EXPIRED_NOTICE[lang])
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => {
      alive = false
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
    }
  }, [lang])

  const signOut = useCallback(async () => {
    await logout()
    setNotice(null)
    setUser(null)
  }, [])

  if (checking) {
    return (
      <div className="auth-splash" role="status" aria-live="polite">
        <span className="auth-brand-static">
          MOON<span>DIAL</span>
        </span>
        <span className="auth-splash-text">{lang === 'es' ? 'Cargando…' : 'Loading…'}</span>
      </div>
    )
  }

  if (!user) {
    return (
      <AuthScreen
        lang={lang}
        notice={notice}
        onAuthenticated={(signedIn) => {
          setNotice(null)
          setUser(signedIn)
        }}
      />
    )
  }

  return <App key={user.id} user={user} onSignOut={signOut} />
}
