import { vi } from 'vitest'
import {
  request,
  fetchBlob,
  getUploadOptions,
  getApiUrl,
  isApiUrl,
  resolveDownloadUrl,
  getRequestCacheKey,
  RequestError
} from './request.js'

function createApi(settings = {}) {
  const api = { url: 'https://example.com/api', ...settings }
  api.getApiUrl = options => getApiUrl(api, options)
  api.isApiUrl = url => isApiUrl(api, url)
  return api
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubFetch({
  status = 200,
  statusText = 'OK',
  contentType = 'application/json',
  body = {}
} = {}) {
  const fetch = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        statusText,
        headers: contentType ? { 'Content-Type': contentType } : {}
      })
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}

describe('request()', () => {
  // Like `fetch()`, rejects with the reason of its signal once it aborts, and
  // otherwise never settles, like a request that hangs.
  function stubHangingFetch() {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (url, { signal }) =>
          new Promise((resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason))
          })
      )
    )
  }

  it('sends the method, JSON data and query to the API URL', async () => {
    const fetch = stubFetch()
    await request(createApi(), {
      url: 'books',
      method: 'patch',
      query: { page: 2 },
      data: { title: 'Orlando' }
    })
    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe('https://example.com/api/books?page=2')
    expect(options).toMatchObject({
      method: 'PATCH',
      body: '{"title":"Orlando"}',
      credentials: 'same-origin'
    })
  })

  it('sends no body without data', async () => {
    const fetch = stubFetch()
    await request(createApi(), { url: 'books' })
    const [, options] = fetch.mock.calls[0]
    expect(options.method).toBe('GET')
    expect(options).not.toHaveProperty('body')
  })

  it('sends the API headers and credentials only to the API', async () => {
    const fetch = stubFetch()
    const api = createApi({
      headers: { Authorization: 'Bearer secret' },
      cors: { credentials: true }
    })
    await request(api, { url: 'books', headers: { 'X-Custom': '1' } })
    await request(api, { url: 'https://elsewhere.org/books' })
    expect(fetch.mock.calls[0][1]).toMatchObject({
      headers: { 'Authorization': 'Bearer secret', 'X-Custom': '1' },
      credentials: 'include'
    })
    expect(fetch.mock.calls[1][1]).toMatchObject({
      headers: {},
      credentials: 'same-origin'
    })
  })

  it('parses JSON responses into `response.data`', async () => {
    stubFetch({ body: [{ id: 1 }] })
    const response = await request(createApi(), { url: 'books' })
    expect(response.data).toEqual([{ id: 1 }])
  })

  it('does not parse other responses', async () => {
    stubFetch({ contentType: 'text/plain' })
    const response = await request(createApi(), { url: 'books' })
    expect(response.data).toBe(undefined)
  })

  it('throws a `RequestError` with the response for failed requests', async () => {
    stubFetch({
      status: 400,
      statusText: 'Bad Request',
      body: { message: 'Invalid title' }
    })
    const error = await request(createApi(), { url: 'books' }).catch(
      error => error
    )
    expect(error).toBeInstanceOf(RequestError)
    expect(error.message).toBe(
      'Request failed with status code: 400 (Bad Request)'
    )
    expect(error.response.data).toEqual({ message: 'Invalid title' })
  })

  it('aborts requests after `api.timeout`', async () => {
    stubHangingFetch()
    const api = createApi({ timeout: 10 })
    await expect(request(api, { url: 'items' })).rejects.toThrow(
      expect.objectContaining({ name: 'TimeoutError' })
    )
  })

  it('aborts requests after their own timeout', async () => {
    stubHangingFetch()
    const api = createApi({ timeout: 60_000 })
    await expect(
      request(api, { url: 'items', timeout: 10 })
    ).rejects.toThrow(expect.objectContaining({ name: 'TimeoutError' }))
  })

  it('aborts requests through their signal', async () => {
    stubHangingFetch()
    const controller = new AbortController()
    const promise = request(createApi(), {
      url: 'items',
      signal: controller.signal
    })
    controller.abort()
    await expect(promise).rejects.toThrow(
      expect.objectContaining({ name: 'AbortError' })
    )
  })
})

describe('fetchBlob()', () => {
  const api = createApi({
    headers: { Authorization: 'Bearer secret' },
    cors: { credentials: true },
    timeout: 60_000
  })

  it('fetches the blob from the API URL', async () => {
    const fetch = stubFetch({ contentType: 'text/plain', body: 'scan' })
    const blob = await fetchBlob(api, 'files/scan.pdf')
    expect(await blob.text()).toBe('"scan"')
    expect(fetch.mock.calls[0][0]).toBe(
      'https://example.com/api/files/scan.pdf'
    )
  })

  it('sends the API headers and credentials only to the API', async () => {
    const fetch = stubFetch()
    await fetchBlob(api, 'files/scan.pdf')
    await fetchBlob(api, 'https://elsewhere.org/scan.pdf')
    const [[, apiOptions], [, otherOptions]] = fetch.mock.calls
    expect(apiOptions).toMatchObject({
      headers: { Authorization: 'Bearer secret' },
      credentials: 'include'
    })
    expect(otherOptions.headers).toEqual({})
    expect(otherOptions.credentials).toBe('same-origin')
  })

  it('fetches root-relative and absolute URLs as they are', async () => {
    const fetch = stubFetch()
    await fetchBlob(api, '/files/scan.pdf')
    await fetchBlob(api, 'https://cdn.org/scan.pdf')
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      '/files/scan.pdf',
      'https://cdn.org/scan.pdf'
    ])
  })

  it('authenticates root-relative URLs only inside the API', async () => {
    const fetch = stubFetch()
    const rootApi = createApi({
      url: '/api',
      headers: { Authorization: 'Bearer secret' }
    })
    await fetchBlob(rootApi, '/api/files/scan.pdf')
    await fetchBlob(rootApi, '/files/scan.pdf')
    // The API is on another origin than the document:
    await fetchBlob(api, '/files/scan.pdf')
    const [[, apiOptions], [, otherOptions], [, otherOriginOptions]] =
      fetch.mock.calls
    expect(apiOptions.headers).toEqual({ Authorization: 'Bearer secret' })
    expect(otherOptions.headers).toEqual({})
    expect(otherOriginOptions.headers).toEqual({})
    expect(otherOriginOptions.credentials).toBe('same-origin')
  })

  it('does not cut off downloads that take longer than `api.timeout`', async () => {
    // Like `fetch()`, rejects with the reason of its signal once it aborts,
    // and otherwise delivers the blob after `api.timeout`, like a download of
    // a large file. Real timers, as fake ones don't drive
    // `AbortSignal.timeout()`.
    const api = createApi({ timeout: 10 })
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (url, { signal }) =>
          new Promise((resolve, reject) => {
            signal?.addEventListener('abort', () => reject(signal.reason))
            setTimeout(() => resolve(new Response('scan')), api.timeout * 5)
          })
      )
    )
    const blob = await fetchBlob(api, 'files/scan.pdf')
    expect(await blob.text()).toBe('scan')
  })

  it('throws a `RequestError` with the response for failed requests', async () => {
    stubFetch({ status: 404, statusText: 'Not Found' })
    const error = await fetchBlob(api, 'files/scan.pdf').catch(error => error)
    expect(error).toBeInstanceOf(RequestError)
    expect(error.response.status).toBe(404)
  })
})

describe('resolveDownloadUrl()', () => {
  it('resolves relative URLs against the API URL', () => {
    expect(resolveDownloadUrl(createApi(), 'files/1')).toBe(
      'https://example.com/api/files/1'
    )
  })

  it('keeps root-relative and absolute URLs', () => {
    const api = createApi({ url: '/api' })
    expect(resolveDownloadUrl(api, '/files/1')).toBe('/files/1')
    expect(resolveDownloadUrl(api, '/api/files/1')).toBe('/api/files/1')
    expect(resolveDownloadUrl(createApi(), '/api/files/1')).toBe(
      '/api/files/1'
    )
    expect(resolveDownloadUrl(api, 'https://cdn.org/x')).toBe(
      'https://cdn.org/x'
    )
  })
})

describe('getRequestCacheKey()', () => {
  const options = {
    method: 'post',
    url: 'books',
    query: { page: 2 },
    data: { title: 'Orlando' }
  }

  it('returns the same key for equal requests', () => {
    expect(getRequestCacheKey({ ...options })).toBe(
      getRequestCacheKey({
        ...options,
        query: { page: 2 },
        data: { title: 'Orlando' }
      })
    )
    expect(getRequestCacheKey({ url: 'books' })).toBe(
      getRequestCacheKey({ method: 'get', url: 'books' })
    )
  })

  it('returns different keys for differing requests', () => {
    const key = getRequestCacheKey(options)
    expect(getRequestCacheKey({ ...options, method: 'put' })).not.toBe(key)
    expect(getRequestCacheKey({ ...options, url: 'authors' })).not.toBe(key)
    expect(getRequestCacheKey({ ...options, query: { page: 3 } })).not.toBe(
      key
    )
    expect(
      getRequestCacheKey({ ...options, data: { title: 'Ulysses' } })
    ).not.toBe(key)
  })
})

describe('getUploadOptions()', () => {
  it('returns the API headers without `Content-Type`', () => {
    const api = createApi({
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer secret'
      }
    })
    expect(getUploadOptions(api, 'items/upload/file')).toEqual({
      headers: { Authorization: 'Bearer secret' },
      withCredentials: false
    })
  })

  it('sends credentials only to the API with CORS credentials', () => {
    const api = createApi({
      headers: { Authorization: 'Bearer secret' },
      cors: { credentials: true }
    })
    expect(getUploadOptions(api, 'items/upload/file')).toEqual({
      headers: { Authorization: 'Bearer secret' },
      withCredentials: true
    })
    expect(getUploadOptions(api, 'https://elsewhere.org/upload')).toEqual({
      headers: {},
      withCredentials: false
    })
  })
})

describe('getApiUrl()', () => {
  const api = createApi({ url: 'https://example.com/api/' })

  it('combines relative URLs with the API URL', () => {
    expect(getApiUrl(api, { url: 'books' })).toBe(
      'https://example.com/api/books'
    )
    expect(getApiUrl(api, { url: '/books/1' })).toBe(
      'https://example.com/api/books/1'
    )
  })

  it('keeps absolute URLs and URLs that start with the API URL', () => {
    expect(getApiUrl(api, { url: 'https://elsewhere.org/books' })).toBe(
      'https://elsewhere.org/books'
    )
    expect(getApiUrl(api, { url: 'https://example.com/api/books' })).toBe(
      'https://example.com/api/books'
    )
  })

  it('appends the query to URLs with and without a search', () => {
    expect(getApiUrl(api, { url: 'books', query: { page: 2 } })).toBe(
      'https://example.com/api/books?page=2'
    )
    expect(
      getApiUrl(api, { url: 'books?order=title', query: { page: 2 } })
    ).toBe('https://example.com/api/books?order=title&page=2')
    expect(getApiUrl(api, { url: 'books', query: {} })).toBe(
      'https://example.com/api/books'
    )
  })
})

describe('isApiUrl()', () => {
  const api = createApi()

  it('treats relative URLs and URLs under the API URL as API URLs', () => {
    expect(isApiUrl(api, 'books')).toBe(true)
    expect(isApiUrl(api, '/books')).toBe(true)
    expect(isApiUrl(api, 'https://example.com/api/books')).toBe(true)
    expect(isApiUrl(api, 'https://elsewhere.org/api/books')).toBe(false)
  })

  it('treats the API URL itself, with and without query, as API URL', () => {
    expect(isApiUrl(api, 'https://example.com/api')).toBe(true)
    expect(isApiUrl(api, 'https://example.com/api?page=2')).toBe(true)
    expect(
      isApiUrl(
        createApi({ url: 'https://example.com/api/' }),
        'https://example.com/api/books'
      )
    ).toBe(true)
  })

  it('compares absolute URLs with a root-relative API URL', () => {
    const api = createApi({ url: '/api' })
    expect(isApiUrl(api, `${location.origin}/api/books`)).toBe(true)
    expect(isApiUrl(api, `${location.origin}/files/1`)).toBe(false)
  })

  it(`doesn't treat URLs that only start like the API URL as API URLs`, () => {
    expect(isApiUrl(api, 'https://example.com/api-docs')).toBe(false)
    expect(isApiUrl(api, 'https://example.com/apis/books')).toBe(false)
  })
})
