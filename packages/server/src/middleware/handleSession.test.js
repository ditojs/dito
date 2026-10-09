import Koa from 'koa'
import { handleSession } from './handleSession.js'

// A minimal stand-in for a session model class, storing values in a map.
function createSessionModel() {
  const values = new Map()
  return class ReaderSession {
    static values = values

    static query() {
      return {
        findById: id => ({
          then: (resolve, reject) =>
            Promise.resolve(
              values.has(id) ? { id, value: values.get(id) } : undefined
            ).then(resolve, reject),
          upsert: async ({ id, value }) => {
            values.set(id, value)
          }
        }),
        deleteById: async id => {
          values.delete(id)
        }
      }
    }

    static getReference(id) {
      return { id }
    }
  }
}

async function withServer({ session, models, transacted = false }, handler) {
  const app = new Koa()
  app.keys = ['library-secret']
  app.models = models
  const errors = []
  app.on('error', error => errors.push(error))
  app.use((ctx, next) => {
    ctx.route = { transacted }
    return next()
  })
  app.use(handleSession(app, session))
  app.use(handler)
  const server = app.listen(0)
  await new Promise(resolve => server.once('listening', resolve))
  const { port } = server.address()
  let cookie = ''
  const request = async (path = '/') => {
    const response = await fetch(`http://localhost:${port}${path}`, {
      headers: { cookie }
    })
    const setCookie = response.headers.getSetCookie()
    if (setCookie.length > 0) {
      cookie = setCookie.map(entry => entry.split(';')[0]).join('; ')
    }
    return { status: response.status, text: await response.text() }
  }
  return { request, errors, close: () => server.close() }
}

function countVisits(ctx) {
  if (ctx.path === '/fail') {
    ctx.session.visits = (ctx.session.visits || 0) + 1
    throw new Error('Shelf collapsed')
  }
  if (ctx.path === '/logout') {
    ctx.session = null
    ctx.body = 'bye'
    return
  }
  ctx.session.visits = (ctx.session.visits || 0) + 1
  ctx.body = String(ctx.session.visits)
}

describe('handleSession()', () => {
  it('stores sessions through a model class found by its name', async () => {
    const ReaderSession = createSessionModel()
    const { request, close } = await withServer(
      {
        session: { modelClass: 'ReaderSession' },
        models: { ReaderSession }
      },
      countVisits
    )
    try {
      expect((await request()).text).toBe('1')
      expect((await request()).text).toBe('2')
      expect([...ReaderSession.values.values()]).toMatchObject([
        { visits: 2 }
      ])
      await request('/logout')
      expect(ReaderSession.values.size).toBe(0)
    } finally {
      close()
    }
  })

  it('stores sessions through a given model class', async () => {
    const ReaderSession = createSessionModel()
    const { request, close } = await withServer(
      { session: { modelClass: ReaderSession }, models: {} },
      countVisits
    )
    try {
      await request()
      expect(ReaderSession.values.size).toBe(1)
    } finally {
      close()
    }
  })

  it('starts empty sessions for stored sessions without value', async () => {
    const ReaderSession = createSessionModel()
    const { request, close } = await withServer(
      { session: { modelClass: ReaderSession }, models: {} },
      countVisits
    )
    try {
      await request()
      const [id] = ReaderSession.values.keys()
      ReaderSession.values.set(id, null)
      expect((await request()).text).toBe('1')
    } finally {
      close()
    }
  })

  it('fails requests when the model class cannot be found', async () => {
    const { request, errors, close } = await withServer(
      { session: { modelClass: 'MissingSession' }, models: {} },
      countVisits
    )
    try {
      expect((await request()).status).toBe(500)
      expect(errors[0].message).toBe(
        `Unable to find model class: 'MissingSession'`
      )
    } finally {
      close()
    }
  })

  it('stores sessions in cookies without a model class', async () => {
    const { request, close } = await withServer(
      { session: {}, models: {} },
      countVisits
    )
    try {
      expect((await request()).text).toBe('1')
      expect((await request()).text).toBe('2')
    } finally {
      close()
    }
  })

  it('commits sessions of failed requests when not transacted', async () => {
    const ReaderSession = createSessionModel()
    const { request, close } = await withServer(
      { session: { modelClass: ReaderSession }, models: {} },
      countVisits
    )
    try {
      expect((await request('/fail')).status).toBe(500)
      expect([...ReaderSession.values.values()]).toMatchObject([
        { visits: 1 }
      ])
    } finally {
      close()
    }
  })

  it('only commits sessions of successful transacted requests', async () => {
    const ReaderSession = createSessionModel()
    const { request, close } = await withServer(
      {
        session: { modelClass: ReaderSession },
        models: {},
        transacted: true
      },
      countVisits
    )
    try {
      expect((await request('/fail')).status).toBe(500)
      expect(ReaderSession.values.size).toBe(0)
      expect((await request()).text).toBe('1')
      expect(ReaderSession.values.size).toBe(1)
    } finally {
      close()
    }
  })

  it(`doesn't commit sessions without \`autoCommit\``, async () => {
    const ReaderSession = createSessionModel()
    const { request, close } = await withServer(
      {
        session: { modelClass: ReaderSession, autoCommit: false },
        models: {}
      },
      countVisits
    )
    try {
      expect((await request()).text).toBe('1')
      expect(ReaderSession.values.size).toBe(0)
    } finally {
      close()
    }
  })
})
