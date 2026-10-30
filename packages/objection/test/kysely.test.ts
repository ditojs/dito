import { Hono } from 'hono'
import { Application } from '@ditojs/server'
import {
  createApp,
  defineController,
  ProblemError,
  problemResponse,
  type DitoContext
} from '@ditojs/server-next'
import { insertAsset } from '@ditojs/storage'
import {
  objectionKysely,
  objectionTransaction,
  requestStorage,
  toProblem
} from '../src/index.ts'

const dito = new Application({
  config: {
    log: { silent: true },
    logger: { level: 'silent' },
    knex: {
      client: 'better-sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true
    }
  },
  models: {}
})

const db = objectionKysely(dito)

// Runs `fn` in a transacted action, which fails after it when `fail` is set.
function run(fn: (c: DitoContext) => Promise<unknown>, fail = false) {
  const app = new Hono()
  app.use(requestStorage(dito))
  app.onError((error, c) => problemResponse(toProblem(error) ?? error, c))
  app.notFound(c => problemResponse(new ProblemError({ status: 404 }), c))
  app.route(
    '/',
    createApp({
      controllers: [
        defineController({
          path: 'notes',
          collection: {
            async post(c) {
              const result = await fn(c)
              if (fail) throw new ProblemError({ status: 409 })
              return result
            }
          }
        })
      ],
      transaction: objectionTransaction(dito),
      getUser: async () => null
    })
  )
  return app.request('/notes', { method: 'POST' })
}

const titles = async () =>
  (await dito.knex('note').select('title').orderBy('id')).map(
    (row: { title: string }) => row.title
  )

beforeAll(async () => {
  await dito.setup()
  await dito.knex.schema.createTable('note', table => {
    table.increments('id')
    table.text('title')
  })
  await dito.knex.schema.createTable('asset', table => {
    table.increments('id')
    table.text('key').unique()
    table.text('file')
    table.text('storage')
    table.integer('count')
    table.text('unreferenced_since')
    table.text('created_at')
    table.text('updated_at')
  })
})

afterAll(async () => {
  await dito.knex.destroy()
})

beforeEach(async () => {
  await dito.knex('note').del()
  await dito.knex('asset').del()
})

describe('objectionKysely()', () => {
  it(`writes in the request's transaction and commits with it`, async () => {
    const response = await run(async c => {
      await db(c).insertInto('note').values({ title: 'Kept' }).execute()
      return db(c).selectFrom('note').select('title').execute()
    })
    expect(await response.json()).toEqual([{ title: 'Kept' }])
    expect(await titles()).toEqual(['Kept'])
  })

  it(`rolls back with the request's transaction`, async () => {
    const response = await run(async c => {
      await db(c).insertInto('note').values({ title: 'Lost' }).execute()
      await dito
        .knex('note')
        .transacting(c.var.trx as never)
        .insert({ title: 'Lost too' })
    }, true)
    expect(response.status).toBe(409)
    expect(await titles()).toEqual([])
  })

  it('rolls back its own transactions with the request', async () => {
    await run(async c => {
      await db(c)
        .transaction()
        .execute(trx =>
          trx.insertInto('note').values({ title: 'Nested' }).execute()
        )
    }, true)
    expect(await titles()).toEqual([])
  })

  it('keeps one Kysely per transaction', async () => {
    const handles: unknown[] = []
    await run(async c => {
      handles.push(db(c), db(c), db())
    })
    await run(async c => {
      handles.push(db(c))
    })
    const [first, second, outside, other] = handles
    expect(first).toBe(second)
    expect(outside).not.toBe(first)
    expect(outside).toBe(db())
    expect(other).not.toBe(first)
  })

  it('runs on `c.var.db` of the request', async () => {
    const other = dito.knex.withUserParams({})
    const c = (knex: unknown) =>
      ({ var: { db: knex } }) as unknown as DitoContext
    expect(db(c(dito.knex))).toBe(db())
    expect(db(c(other))).not.toBe(db())
    expect(db(c(other))).toBe(db(c(other)))
  })

  it(`runs on the application's knex outside a request`, async () => {
    await db().insertInto('note').values({ title: 'Outside' }).execute()
    expect(await titles()).toEqual(['Outside'])
    expect(await db().selectFrom('note').select('title').execute()).toEqual([
      { title: 'Outside' }
    ])
  })

  it("inserts assets of `@ditojs/storage` in the request's transaction", async () => {
    let inserted: unknown[] = []
    await run(async c => {
      await insertAsset(db(c), { key: 'a', name: 'a.png' }, 'covers')
      inserted = await db(c).selectFrom('asset').select('key').execute()
    }, true)
    expect(inserted).toEqual([{ key: 'a' }])
    expect(await dito.knex('asset')).toEqual([])
  })
})
