import {
  createKeygrip,
  type CookieOptions,
  type SignedCookies
} from './cookies.ts'

// Signed cookies as Koa writes them with the `cookies` package: the cookie
// `name` holds the value, and `name.sig` the Keygrip signature of
// `name=value`. Apps that move from Dito 6 pass `koaCookies(keys)` to
// `createSessions()`, so the existing sessions stay valid.

export function koaCookies(
  keys: string[],
  { algorithm = 'sha1' }: { algorithm?: string } = {}
): SignedCookies {
  const keygrip = createKeygrip(keys, algorithm)
  return {
    get(headers, name) {
      const header = headers.get('Cookie')
      const value = header && readCookie(header, name)
      const signature = header && readCookie(header, `${name}.sig`)
      if (!value || !signature) return null
      const index = keygrip.index(`${name}=${value}`, signature)
      return index >= 0 ? { value, index } : null
    },

    set(headers, name, value, options = {}) {
      const removal = value === null
      const cookieOptions = removal
        ? { ...options, expires: new Date(0) }
        : options
      const cookie = `${name}=${value ?? ''}`
      const signature = `${name}.sig=${keygrip.sign(cookie)}`
      for (const pair of [cookie, signature]) {
        headers.append('Set-Cookie', formatCookie(pair, cookieOptions))
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
