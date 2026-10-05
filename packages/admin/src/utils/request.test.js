import { vi } from 'vitest'
import { request, getApiUrl, isApiUrl } from './request.js'

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
