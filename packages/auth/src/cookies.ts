import { createHmac, timingSafeEqual } from 'node:crypto'

// The interface of signed cookies that `createSessions()` takes, and the
// Keygrip signatures of Koa. Keygrip signs with the first key and verifies
// with all of them, so keys can rotate. Its digest is base64 with the
// characters of base64url and no padding, which is Node's `base64url`.
// `koaCookies()` in `@ditojs/auth/koa` reads and writes Koa's cookies.

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

// Cookies are read from the `Cookie` header of the request's headers, and
// set as `Set-Cookie` headers on the response's headers.
export interface SignedCookies {
  get(headers: Headers, name: string): SignedCookie | null
  // A null value removes the cookie.
  set(
    headers: Headers,
    name: string,
    value: string | null,
    options?: CookieOptions
  ): void
}

function isEqual(a: string, b: string) {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB)
}
