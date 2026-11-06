import { Hono } from 'hono'
import pino from 'pino'
import { createRequestLogger } from './createRequestLogger.ts'

describe('createRequestLogger()', () => {
  const create = () => {
    const entries: Record<string, unknown>[] = []
    const logger = pino(
      {},
      { write: line => void entries.push(JSON.parse(line)) }
    )
    const app = new Hono()
    app.use(createRequestLogger(logger))
    app.get('/books', c => {
      c.set('action', 'get')
      c.var.logger.info('Reading')
      return c.text('books')
    })
    app.get('/fail', c => {
      c.set('action', 'get fail')
      throw new Error('Failed')
    })
    app.get('/file.js', c => c.text('file'))
    return { app, entries }
  }

  it('logs each action with the id of its request', async () => {
    const { app, entries } = create()
    const response = await app.request('/books?page=2')
    await app.request('/books')
    const [reading, first, , second] = entries
    expect(reading).toMatchObject({ msg: 'Reading' })
    expect(reading!.requestId).toBe(first!.requestId)
    expect(first!.msg).toMatch(/^GET \/books\?page=2 200 \d+ms$/)
    expect(first!.requestId).toBe(response.headers.get('X-Request-Id'))
    expect(second!.requestId).not.toBe(first!.requestId)
  })

  it('logs failed actions', async () => {
    const { app, entries } = create()
    expect((await app.request('/fail')).status).toBe(500)
    expect(entries[0]!.msg).toMatch(/^GET \/fail 500 \d+ms$/)
  })

  it('logs no other requests', async () => {
    const { app, entries } = create()
    await app.request('/file.js')
    await app.request('/other')
    expect(entries).toEqual([])
  })
})
