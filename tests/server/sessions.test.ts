import { vi } from 'vitest'
import { Controller, SessionModel } from '@ditojs/server'
import { createTestApp, getAppUrl } from '../utils/app.js'
import { createClient } from '../utils/client.js'
import { createTestDatabase } from '../utils/database.js'

const day = 24 * 60 * 60 * 1000

class Session extends SessionModel {
  declare expiresAt: Date | null
}

class Visits extends Controller {
  override actions: any = {
    'get visit'(ctx: any) {
      const { maxAge } = ctx.query
      if (maxAge) {
        ctx.session.maxAge = maxAge === 'session' ? maxAge : +maxAge
      }
      ctx.session.visits = (ctx.session.visits || 0) + 1
      return { visits: ctx.session.visits }
    }
  }
}

describe('Sessions', () => {
  const app = createTestApp({
    config: {
      app: {
        normalizePaths: true,
        helmet: false,
        keys: ['test-secret'],
        session: { modelClass: 'Session' }
      }
    },
    models: { Session },
    controllers: { Visits }
  })

  // Each visit comes from a new client, with a new session:
  const visit = async (maxAge?: string) => {
    const { status } = await createClient(getAppUrl(app))(
      `/visits/visit${maxAge ? `?maxAge=${maxAge}` : ''}`
    )
    expect(status).toBe(200)
  }

  const getExpiresAt = async () => {
    const sessions = await Session.query().orderBy('expiresAt', 'asc', 'last')
    return sessions.map(({ expiresAt }) => expiresAt?.getTime() ?? null)
  }

  beforeAll(async () => {
    await createTestDatabase(app)
    await app.start()
  })

  afterAll(async () => {
    await app.stop()
    await app.knex.destroy()
  })

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))
  })

  afterEach(async () => {
    vi.useRealTimers()
    await Session.query().delete()
  })

  it('stores the expiry of sessions in `expiresAt`', async () => {
    await visit()
    await visit('session')
    expect(await getExpiresAt()).toEqual([Date.now() + day, null])
  })

  it('deletes expired sessions through `app.deleteExpiredRecords()`', async () => {
    const start = Date.now()
    await visit()
    await visit('session')
    vi.setSystemTime(start + day / 2)
    await visit()
    vi.setSystemTime(start + day + 1)
    await app.deleteExpiredRecords()
    // Browser sessions have no expiry, and are kept:
    expect(await getExpiresAt()).toEqual([start + day / 2 + day, null])
  })
})
