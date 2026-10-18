// tests/utils/client.ts

// A JSON client of the app at `url` with a minimal cookie jar, to keep the
// session between requests, and optional headers for all requests.
export function createClient(
  url: string,
  headers: Record<string, string> = {}
) {
  const cookies = new Map<string, string>()
  return async (
    path: string,
    { method = 'GET', body }: { method?: string; body?: any } = {}
  ) => {
    const response = await fetch(`${url}${path}`, {
      method,
      headers: {
        ...headers,
        'accept': 'application/json',
        'content-type': 'application/json',
        'cookie': [...cookies]
          .map(([key, value]) => `${key}=${value}`)
          .join('; ')
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
    for (const cookie of response.headers.getSetCookie()) {
      const [, key, value] = cookie.match(/^([^=]+)=([^;]*)/) ?? []
      if (value) {
        cookies.set(key, value)
      } else {
        cookies.delete(key)
      }
    }
    const isJson = response.headers.get('content-type')?.includes('json')
    return {
      status: response.status,
      data: isJson ? await response.json() : null
    }
  }
}
