import { isAbsoluteUrl, isString } from '@ditojs/utils'
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

// Responses without a message have none, e.g. `{ type: 'ServerError' }`:
export function getErrorMessage(error) {
  return isString(error?.message) ? error.message : null
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

/** @param {Record<string, any>} options */
export function getRequestCacheKey({ method, url, query, data }) {
  return [
    method || 'get',
    url,
    JSON.stringify(query || ''),
    JSON.stringify(data || '')
  ].join(' ')
}

// Unlike `getApiUrl()`, keep root-relative URLs such as `/files/1` as they are:
export function resolveDownloadUrl(api, url) {
  return isAbsoluteUrl(url) || url.startsWith('/')
    ? url
    : api.getApiUrl({ url })
}

export async function fetchBlob(api, url) {
  const downloadUrl = resolveDownloadUrl(api, url)
  // Decide on the authentication with the absolute URL, as `isApiUrl()` treats
  // all root-relative URLs as API URLs. No `api.timeout`, as it would cut off
  // downloads of large files:
  const response = await fetch(
    downloadUrl,
    getFetchOptions(api, getAbsoluteUrl(downloadUrl))
  )
  if (!response.ok) {
    throw new RequestError(response)
  }
  return response.blob()
}

export function getUploadOptions(api, url) {
  const { headers, credentials } = getFetchOptions(api, url)
  // Leave out the JSON `Content-Type`, as `XMLHttpRequest` needs to set the
  // boundary of the multipart form data itself:
  return {
    headers: Object.fromEntries(
      Object.entries(headers).filter(
        ([name]) => name.toLowerCase() !== 'content-type'
      )
    ),
    withCredentials: credentials === 'include'
  }
}

// Only requests to the API receive its headers and, with CORS, its credentials:
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

// Abort after the timeout too, so nothing waits for requests forever:
function getRequestSignal({ signal = null, timeout = null }) {
  const signals = [signal, timeout && AbortSignal.timeout(timeout)]
  return AbortSignal.any(signals.filter(Boolean))
}

// Relative and root-relative URLs go to the API, as `getApiUrl()` resolves them
// against it. Compare absolute forms, so a root-relative API URL matches too:
export function isApiUrl(api, url) {
  return (
    !isAbsoluteUrl(url) ||
    isUrlInside(getAbsoluteUrl(url), getAbsoluteUrl(api.url))
  )
}

function getAbsoluteUrl(url) {
  return new URL(url, document.baseURI).href
}

// `/api/books` is inside `/api`, but `/api-docs` isn't:
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
  const search = formatQuery(query)
  return search ? `${url}${url.includes('?') ? '&' : '?'}${search}` : url
}

function combineUrls(baseUrl, relativeUrl) {
  // Use same approach as axios `combineURLs()` to join baseUrl & relativeUrl:
  return `${baseUrl.replace(/\/+$/, '')}/${relativeUrl.replace(/^\/+/, '')}`
}
