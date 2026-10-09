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
  const fetchOptions = getFetchOptions(api, url)
  const response = await fetch(api.getApiUrl({ url, query }), {
    method: method.toUpperCase(),
    ...(data && { body: JSON.stringify(data) }),
    headers: {
      ...fetchOptions.headers,
      ...headers
    },
    credentials: fetchOptions.credentials,
    signal: getRequestSignal({ signal, timeout })
  })

  if (response.headers.get('Content-Type')?.includes('application/json')) {
    response.data = await response.json()
  }

  if (!response.ok) {
    throw new RequestError(response)
  }
  return response
}

// Fetches the file at `url` as a blob, with the same authentication as
// `request()`, e.g. for downloads of files that the API protects.
export async function fetchBlob(api, url) {
  const response = await fetch(api.getApiUrl({ url }), {
    ...getFetchOptions(api, url),
    signal: getRequestSignal({ timeout: api.timeout ?? null })
  })
  if (!response.ok) {
    throw new RequestError(response)
  }
  return response.blob()
}

// Returns the options for uploads to `url` through `XMLHttpRequest`, with the
// same authentication as `request()`.
export function getUploadOptions(api, url) {
  const { headers, credentials } = getFetchOptions(api, url)
  // Leave out the default JSON `Content-Type`, as uploads send multipart form
  // data, the boundary of which `XMLHttpRequest` needs to set itself.
  return {
    headers: Object.fromEntries(
      Object.entries(headers).filter(
        ([name]) => name.toLowerCase() !== 'content-type'
      )
    ),
    withCredentials: credentials === 'include'
  }
}

// Returns the headers and credentials mode that requests to `url` send: Only
// requests to the API receive its headers and, with CORS, its credentials.
function getFetchOptions(api, url) {
  const isApiUrl = api.isApiUrl(url)
  return {
    headers: { ...(isApiUrl && api.headers) },
    credentials:
      isApiUrl && api.cors?.credentials
        ? 'include'
        : 'same-origin'
  }
}

// Returns a signal that aborts with `signal`, and after the timeout if there is
// one, so that nothing waits for requests forever, e.g. submitting for pending
// loads.
function getRequestSignal({ signal = null, timeout = null }) {
  const signals = [signal, timeout && AbortSignal.timeout(timeout)]
  return AbortSignal.any(signals.filter(Boolean))
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
