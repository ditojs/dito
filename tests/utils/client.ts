// A client of the app behind `fetch`, such as a Hono app's `fetch`, with the
// cookie jar of a browser for one host. `init` adds to the request, or replaces
// the JSON of `body`. `data` holds the parsed JSON of an answer, else its text.
export function createClient(
  fetch: (request: Request) => Response | Promise<Response>,
  origin = 'https://example.com'
) {
  const jar = new Map<string, string>()

  async function request(
    method: string,
    path: string,
    body?: unknown,
    init: RequestInit = {}
  ) {
    const response = await fetch(
      new Request(`${origin}${path}`, {
        method,
        ...(body !== undefined && { body: JSON.stringify(body) }),
        ...init,
        headers: {
          ...(jar.size > 0 && {
            Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; ')
          }),
          ...(body !== undefined && { 'Content-Type': 'application/json' }),
          ...init.headers
        }
      })
    )
    const cookies = response.headers.getSetCookie()
    for (const cookie of cookies) {
      const [pair, ...attributes] = cookie.split('; ')
      const index = pair.indexOf('=')
      const key = pair.slice(0, index)
      if (attributes.includes('Max-Age=0')) jar.delete(key)
      else jar.set(key, pair.slice(index + 1))
    }
    const text = await response.text()
    const isJson = response.headers.get('Content-Type')?.includes('json')
    return {
      status: response.status,
      headers: response.headers,
      cookies,
      data: text && isJson ? JSON.parse(text) : text || undefined
    }
  }

  return {
    jar,
    request,
    get: (path: string) => request('GET', path),
    post: (path: string, body: unknown = {}) => request('POST', path, body),
    delete: (path: string) => request('DELETE', path)
  }
}
