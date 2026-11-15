import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthError,
  getStoredToken,
  isValidEmail,
  login,
  logout,
  register,
  restoreSession,
} from './authApi.ts'

const store = new Map<string, string>()
const user = { id: 1, name: 'Ada', email: 'ada@orysel.test' }

function reply(status: number, body?: unknown) {
  return Promise.resolve(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('authApi', () => {
  it('keeps the token after signing in and sends it as a Bearer header, never a cookie', async () => {
    const fetchMock = vi.fn((url: string, init: RequestInit) => {
      void url
      void init
      return reply(200, { token: 'tok-123', user })
    })
    vi.stubGlobal('fetch', fetchMock)

    expect(await login(' ada@orysel.test ', 'secret-pass')).toEqual(user)
    expect(getStoredToken()).toBe('tok-123')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/api\/auth\/login$/)
    expect(init.credentials).toBe('omit')
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'ada@orysel.test',
      password: 'secret-pass',
    })

    fetchMock.mockImplementation(() => reply(200, { user }))
    expect(await restoreSession()).toEqual(user)
    const headers = fetchMock.mock.calls[1][1].headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer tok-123')
  })

  it('maps server answers to messages the screen can show', async () => {
    vi.stubGlobal('fetch', () => reply(401, { detail: 'Incorrect email or password' }))
    await expect(login('ada@orysel.test', 'wrong')).rejects.toMatchObject({ code: 'credentials' })

    vi.stubGlobal('fetch', () => reply(409, { detail: 'exists' }))
    await expect(register('Ada', 'ada@orysel.test', 'long-enough')).rejects.toMatchObject({
      code: 'exists',
    })

    vi.stubGlobal('fetch', () => reply(429, { detail: 'slow down' }))
    await expect(login('ada@orysel.test', 'x')).rejects.toMatchObject({ code: 'throttled' })

    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('offline')))
    await expect(login('ada@orysel.test', 'x')).rejects.toBeInstanceOf(AuthError)
    expect(getStoredToken()).toBeNull()
  })

  it('forgets an expired session and signs out locally even if the server is down', async () => {
    store.set('orysel.session.v1', 'old')
    vi.stubGlobal('fetch', () => reply(401, { detail: 'expired' }))
    expect(await restoreSession()).toBeNull()
    expect(getStoredToken()).toBeNull()

    store.set('orysel.session.v1', 'tok')
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('offline')))
    await logout()
    expect(getStoredToken()).toBeNull()
  })

  it('validates emails', () => {
    expect(isValidEmail('tu@correo.com')).toBe(true)
    expect(isValidEmail(' tu@correo.com ')).toBe(true)
    expect(isValidEmail('tu@correo')).toBe(false)
    expect(isValidEmail('a b@correo.com')).toBe(false)
    expect(isValidEmail('@correo.com')).toBe(false)
  })
})
