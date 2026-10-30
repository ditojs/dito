import { createHmac, timingSafeEqual } from 'node:crypto'
import type { AnyContext } from './types.ts'

// Signed cookies as Koa writes them with the `cookies` package: the cookie
// `name` holds the value, and `name.sig` the Keygrip signature of
// `name=value`. Keygrip signs with the first key and verifies with all of
// them, so keys can rotate. Its digest is base64 with the characters of
// base64url and no padding, which is Node's `base64url`.

export interface Keygrip {
  sign(data: string): string
  verify(data: string, digest: string): boolean
  // The index of the key that signed `data`, or -1.
  index(data: string, digest: string): number
}

export function createKeygrip(keys: string[], algorithm = 'sha1'): Keygrip {
  if (keys.length === 0) {
    throw new Error('Unable to sign without keys.')
  }
  const sign = (data: string, key: string) =>
    createHmac(algorithm, key).update(data).digest('base64url')
  const index = (data: string, digest: string) =>
    keys.findIndex(key => isEqual(digest, sign(data, key)))
  return {
    sign: data => sign(data, keys[0]),
    verify: (data, digest) => index(data, digest) >= 0,
    index
  }
}

export interface CookieOptions {
  expires?: Date
  path?: string
  domain?: string
  sameSite?: 'lax' | 'strict' | 'none' | false
  secure?: boolean
  httpOnly?: boolean
}

export interface SignedCookie {
  value: string
  // The index of the key that signed it. Above 0, sessions sign it again.
  index: number
}

export interface SignedCookies {
  get(c: AnyContext, name: string): SignedCookie | null
  // A null value removes the cookie.
  set(
    c: AnyContext,
    name: string,
    value: string | null,
    options?: CookieOptions
  ): void
}

export function koaCookies(
  keys: string[],
  { algorithm = 'sha1' }: { algorithm?: string } = {}
): SignedCookies {
  const keygrip = createKeygrip(keys, algorithm)
  return {
    get(c, name) {
      const header = c.req.header('Cookie')
      const value = header && readCookie(header, name)
      const signature = header && readCookie(header, `${name}.sig`)
      if (!value || !signature) return null
      const index = keygrip.index(`${name}=${value}`, signature)
      return index >= 0 ? { value, index } : null
    },

    set(c, name, value, options = {}) {
      const removal = value === null
      const cookieOptions = removal
        ? { ...options, expires: new Date(0) }
        : options
      const cookie = `${name}=${value ?? ''}`
      const signature = `${name}.sig=${keygrip.sign(cookie)}`
      for (const pair of [cookie, signature]) {
        c.header('Set-Cookie', formatCookie(pair, cookieOptions), {
          append: true
        })
      }
    }
  }
}

// Reads the raw value, as `cookies` does, without decoding it.
function readCookie(header: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = header.match(new RegExp(`(?:^|;) *${escaped}=([^;]*)`))
  const value = match?.[1]
  return value?.startsWith('"') ? value.slice(1, -1) : value
}

// The attributes in the order of `cookies`, with its defaults.
function formatCookie(
  pair: string,
  {
    expires,
    path = '/',
    domain,
    sameSite = false,
    secure = false,
    httpOnly = true
  }: CookieOptions
) {
  return [
    pair,
    path && `path=${path}`,
    expires && `expires=${expires.toUTCString()}`,
    domain && `domain=${domain}`,
    sameSite && `samesite=${sameSite}`,
    secure && 'secure',
    httpOnly && 'httponly'
  ]
    .filter(Boolean)
    .join('; ')
}

function isEqual(a: string, b: string) {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB)
}
