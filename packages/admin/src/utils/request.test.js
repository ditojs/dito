import { vi } from 'vitest'
import { request, getApiUrl, isApiUrl, RequestError } from './request.js'

function createApi(settings = {}) {
  const api = { url: 'https://example.com/api', ...settings }
  api.getApiUrl = options => getApiUrl(api, options)
  api.isApiUrl = url => isApiUrl(api, url)
  return api
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
})
