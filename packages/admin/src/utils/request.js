import { isAbsoluteUrl } from '@ditojs/utils'
import { formatQuery } from './route.js'

export class RequestError extends Error {
  constructor(response) {
    super(
      `Request failed with status code: ${response.status} (${
        response.statusText
      })`
    )
    this.response = response
  }
}

export async function request(api, {
  url,
  method = 'get',
  query = null,
  headers = null,
  data = null,
  signal = null,
  timeout = api.timeout ?? null
}) {
  const isApiUrl = api.isApiUrl(url)
  // Abort requests that take longer than the timeout, if there is one, so that
  // nothing waits for them forever, e.g. submitting for pending loads:
  const signals = [signal, timeout && AbortSignal.timeout(timeout)]
  signal = AbortSignal.any(signals.filter(Boolean))

  const response = await fetch(api.getApiUrl({ url, query }), {
    method: method.toUpperCase(),
    ...(data && { body: JSON.stringify(data) }),
    headers: {
      ...(isApiUrl && api.headers),
      ...headers
    },
    credentials:
      isApiUrl && api.cors?.credentials
        ? 'include'
        : 'same-origin',
    signal
  })

  if (response.headers.get('Content-Type')?.includes('application/json')) {
    response.data = await response.json()
  }

  if (!response.ok) {
    throw new RequestError(response)
  }
  return response
}

export function isApiUrl(api, url) {
  return !isAbsoluteUrl(url) || isUrlInside(url, api.url)
}

// Returns whether `url` is `baseUrl` or a URL under it, e.g. `/api/books` in
// `/api`, but not `/api-docs`.
function isUrlInside(url, baseUrl) {
  if (!url.startsWith(baseUrl)) {
    return false
  }
  const nextCharacter = url[baseUrl.length]
  return (
    baseUrl.endsWith('/') ||
    nextCharacter === undefined ||
    '/?#'.includes(nextCharacter)
  )
}

export function getApiUrl(api, { url, query }) {
  if (!url.startsWith(api.url) && !isAbsoluteUrl(url)) {
    url = combineUrls(api.url, url)
  }
  // Support optional query parameters, to be are added to the URL.
  const search = formatQuery(query)
  return search ? `${url}${url.includes('?') ? '&' : '?'}${search}` : url
}

function combineUrls(baseUrl, relativeUrl) {
  // Use same approach as axios `combineURLs()` to join baseUrl & relativeUrl:
  return `${baseUrl.replace(/\/+$/, '')}/${relativeUrl.replace(/^\/+/, '')}`
}
