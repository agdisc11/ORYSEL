/**
 * Accounts on the ORYSEL AWS backend (`/api/auth/*` in pruebas/bd-nasa/api.py).
 *
 * The server keeps scrypt password hashes and only the SHA-256 of each
 * session token. The browser keeps the token in localStorage and sends it as
 * a Bearer header (never as a cookie), so other sites cannot use it.
 */
import { getEffectiveAwsUrl } from './awsApi.ts'
import type { SiteReport } from './types.ts'

/** Fired on window when the server rejects the stored token (expired or revoked). */
export const SESSION_EXPIRED_EVENT = 'orysel:session-expired'

export interface AuthUser {
  id: number
  name: string
  email: string
}

interface AuthResponse {
  token: string
  user: AuthUser
}

const STORAGE_KEY = 'orysel.session.v1'
const TIMEOUT_MS = 10_000

export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128
export const NAME_MAX = 80
export const EMAIL_MAX = 254

/** Error shown to the person; `code` lets the screen pick the wording. */
export class AuthError extends Error {
  code: 'invalid' | 'exists' | 'credentials' | 'throttled' | 'network' | 'expired' | 'server'
  constructor(code: AuthError['code'], message: string) {
    super(message)
    this.code = code
  }
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function storeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Private mode without storage: the session simply lasts for this tab.
  }
}

async function request<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (init.body) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  let response: Response
  try {
    response = await fetch(getEffectiveAwsUrl(path), {
      ...init,
      headers,
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-store',
    })
  } catch {
    throw new AuthError('network', 'No connection to the server')
  } finally {
    clearTimeout(timer)
  }
  if (response.status === 204) return undefined as T
  if (!response.ok) {
    const code: AuthError['code'] =
      response.status === 401
        ? token
          ? 'expired'
          : 'credentials'
        : response.status === 409
          ? 'exists'
          : response.status === 422
            ? 'invalid'
            : response.status === 429
              ? 'throttled'
              : 'server'
    throw new AuthError(code, `HTTP ${response.status}`)
  }
  return (await response.json()) as T
}

export async function register(name: string, email: string, password: string): Promise<AuthUser> {
  const data = await request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
  })
  storeToken(data.token)
  return data.user
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const data = await request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim(), password }),
  })
  storeToken(data.token)
  return data.user
}

/** The signed-in person, or null if there is no valid session. */
export async function restoreSession(): Promise<AuthUser | null> {
  const token = getStoredToken()
  if (!token) return null
  try {
    const data = await request<{ user: AuthUser }>('/api/auth/me', {}, token)
    return data.user
  } catch (error) {
    if (error instanceof AuthError && error.code === 'expired') storeToken(null)
    return null
  }
}

export async function logout(): Promise<void> {
  const token = getStoredToken()
  storeToken(null)
  if (!token) return
  try {
    await request<void>('/api/auth/logout', { method: 'POST' }, token)
  } catch {
    // The local session is already gone; the server copy expires on its own.
  }
}

/** Forget the local session and tell the app to show the sign-in screen. */
export function notifySessionExpired(): void {
  storeToken(null)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
}

/** Precomputed SPICE report of one site; requires a signed-in session. */
export async function fetchReport(siteId: string): Promise<SiteReport> {
  const token = getStoredToken()
  if (!token) {
    notifySessionExpired()
    throw new AuthError('expired', 'Not signed in')
  }
  try {
    return await request<SiteReport>(`/api/reports/${encodeURIComponent(siteId)}`, {}, token)
  } catch (error) {
    if (error instanceof AuthError && error.code === 'expired') notifySessionExpired()
    throw error
  }
}

export function isValidEmail(email: string): boolean {
  const value = email.trim()
  return value.length <= EMAIL_MAX && /^[^@\s]{1,64}@[^@\s]{1,189}\.[^@\s]{2,63}$/.test(value)
}
