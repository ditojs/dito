import { vi } from 'vitest'
import { handleRoute } from './handleRoute.js'

function createContext(route) {
  const headers = {}
  return {
    route,
    body: undefined,
    status: 404,
    headers,
    set(field, value) {
      headers[field] = value
    }
  }
}

describe('handleRoute()', () => {
  it('calls the middleware of found routes', async () => {
    const middleware = vi.fn()
    const ctx = createContext({ middleware })
    const next = vi.fn()
    await handleRoute()(ctx, next)
    expect(middleware).toHaveBeenCalledWith(ctx, next)
  })

  it('responds with the status and allowed methods of the router', async () => {
    const ctx = createContext({ status: 405, allowed: ['GET', 'POST'] })
    await handleRoute()(ctx, async () => {})
    expect(ctx.status).toBe(405)
    expect(ctx.headers).toEqual({ Allow: 'GET, POST' })
  })

  it('responds with 404 when the router provides no status', async () => {
    const ctx = createContext({ allowed: ['GET'] })
    await handleRoute()(ctx, async () => {})
    expect(ctx.status).toBe(404)
    expect(ctx.headers).toEqual({})
  })

  it('keeps responses of the remaining middleware', async () => {
    const ctx = createContext({ status: 405, allowed: ['GET'] })
    await handleRoute()(ctx, async () => {
      ctx.status = 200
      ctx.body = 'handled'
    })
    expect(ctx.status).toBe(200)
    expect(ctx.headers).toEqual({})
  })
})
