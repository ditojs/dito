import type { Kysely } from 'kysely'
import { Hono } from 'hono'
import { defineEntity, p } from '@mikro-orm/core'
import { createApi } from '@ditojs/server'
import {
  createSessions,
  definePasswordWrites,
  defineUserActions,
  getSessionUser,
  hashPassword,
  verifyPassword
} from '../../auth/src/index.ts'
import {
  createEntityUserSource,
  createMikroAdapter,
  defineModelController
} from './index.ts'
import { createTestDatabase } from '../../../tests/utils/database.ts'
import { Session } from '../../../tests/utils/entities.ts'
import { createClient } from '../../../tests/utils/client.ts'

// `createEntityUserSource()` and `definePasswordWrites()` of auth on a model
// controller.

const MemberSchema = defineEntity({
  name: 'Member',
  tableName: 'member',
  properties: {
    id: p.integer().primary(),
    username: p.string().unique(),
    hash: p.string().nullable().hidden(),
    roles: p.json<string[]>().nullable(),
    lastLogin: p.datetime().nullable()
  }
})
class Member extends MemberSchema.class {}
MemberSchema.setClass(Member)

const { orm, db, drop } = await createTestDatabase([Member, Session])

afterAll(drop)

const source = createEntityUserSource(Member, {
  em: orm.em,
  serialize: ['id', 'username']
})

const sessions = createSessions({
  adapter: { getKysely: () => db as Kysely<any> },
  secrets: ['secret sauce'],
  cookieName: 'member.sess',
  maxAge: 60_000
})

const app = new Hono().route(
  '/',
  createApi({
    adapter: createMikroAdapter(orm),
    middleware: [sessions.middleware],
    getUser: ({ c }) => getSessionUser(c, source),
    controllers: [
      { path: 'auth', mixins: [defineUserActions({ source })] },
      defineModelController({
        path: 'members',
        entity: Member,
        authorize: true,
        mixins: [definePasswordWrites({ source })]
      })
    ]
  })
)

const load = (id: number) => orm.em.fork().findOneOrFail(Member, id)

let ada: Member

beforeEach(async () => {
  await orm.em.getConnection().execute(
    'truncate member, session restart identity'
  )
  const em = orm.em.fork()
  ada = em.create(Member, {
    username: 'ada',
    hash: await hashPassword('secret'),
    roles: []
  })
  await em.flush()
})

const login = async () => {
  const client = createClient(app.fetch)
  await client.post('/auth/login', { username: 'ada', password: 'secret' })
  return client
}

const self = async (client: ReturnType<typeof createClient>) =>
  (await client.get('/auth/self')).data

describe('createEntityUserSource() with auth', () => {
  it('logs in and stores the time of the login', async () => {
    expect(await self(await login())).toEqual({ id: 1, username: 'ada' })
    expect((await load(ada.id)).lastLogin).toBeInstanceOf(Date)
  })

  it('stores the hash of a new user', async () => {
    const { status } = await createClient(app.fetch).post('/members', {
      username: 'bob',
      password: '12345678'
    })
    expect(status).toBe(201)
    const bob = await orm.em.fork().findOneOrFail(Member, { username: 'bob' })
    expect(await verifyPassword('12345678', bob.hash)).toBe(true)
  })

  it('keeps the session through a change of the own password', async () => {
    const first = await login()
    const second = await login()
    const { status } = await first.request('PATCH', `/members/${ada.id}`, {
      password: 'new secret'
    })
    expect(status).toBe(200)
    expect(await verifyPassword('new secret', (await load(ada.id)).hash)).toBe(
      true
    )
    expect(await self(first)).toEqual({ id: 1, username: 'ada' })
    expect(await self(second)).toBe(null)
  })

  it('keeps the session when the flush fails', async () => {
    const em = orm.em.fork()
    em.create(Member, { username: 'bob', hash: null, roles: [] })
    await em.flush()
    const client = await login()
    const { status } = await client.request('PATCH', `/members/${ada.id}`, {
      username: 'bob',
      password: 'new secret'
    })
    expect(status).toBe(409)
    expect(await verifyPassword('secret', (await load(ada.id)).hash)).toBe(true)
    expect(await self(client)).toEqual({ id: 1, username: 'ada' })
  })

  it('rejects a hash in the body', async () => {
    const { status } = await createClient(app.fetch).request(
      'PATCH',
      `/members/${ada.id}`,
      { hash: 'x' }
    )
    expect(status).toBe(400)
  })
})

describe('definePasswordWrites() with confirmed access', () => {
  // A login confirms the access for no time, and `self` is the logged-in user.
  const app = new Hono().route(
    '/',
    createApi({
      adapter: createMikroAdapter(orm),
      middleware: [sessions.middleware],
      getUser: ({ c }) => getSessionUser(c, source),
      controllers: [
        {
          path: 'auth',
          mixins: [defineUserActions({ source, reconfirmAfter: 0 })]
        },
        defineModelController({
          path: 'members',
          entity: Member,
          authorize: true,
          mixins: [definePasswordWrites({ source })],
          load: ({ c, id }) =>
            c.var.em.findOne(
              Member,
              Number(id === 'self' ? c.var.user!.id : id)
            )
        })
      ]
    })
  )

  it('needs it to change usernames, also of other users', async () => {
    const em = orm.em.fork()
    const bob = em.create(Member, { username: 'bob', hash: null, roles: [] })
    await em.flush()
    const client = createClient(app.fetch)
    await client.post('/auth/login', { username: 'ada', password: 'secret' })
    const patch = (id: number | string, body: object) =>
      client.request('PATCH', `/members/${id}`, body)
    const confirmationRequired = {
      status: 403,
      data: { confirmationRequired: true }
    }
    expect(await patch('self', { username: 'ad' })).toMatchObject(
      confirmationRequired
    )
    expect(await patch(bob.id, { username: 'b' })).toMatchObject(
      confirmationRequired
    )
    // Forms send the unchanged username with their other values:
    expect((await patch('self', { username: 'ada', roles: [] })).status).toBe(
      200
    )
    expect((await patch(bob.id, { username: 'bob', roles: [] })).status).toBe(
      200
    )
  })
})
