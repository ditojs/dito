import { Hono } from 'hono'
import { defineEntity, p } from '@mikro-orm/core'
import { createApi, HttpError } from '@ditojs/server'
import { createMikroAdapter, crud, defineModelController } from '@ditojs/mikro'
import { createUsers } from './index.ts'
import { hashPassword, verifyPassword } from './passwords.ts'
import { createTestDatabase } from '../../../tests/utils/database.ts'
import { Credential, Session } from '../../../tests/utils/entities.ts'
import { createClient } from '../../../tests/utils/client.ts'

// `createUsers()` on a model controller.

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

const { orm, drop } = await createTestDatabase([Member, Session, Credential])

afterAll(drop)

const adapter = createMikroAdapter(orm)

const members = createUsers(Member, {
  adapter,
  secrets: ['secret sauce'],
  session: { cookieName: 'member.sess', expiresAfter: 60_000 },
  serialize: ['id', 'username']
})

const app = new Hono().route(
  '/',
  createApi({
    adapter,
    users: members,
    controllers: [
      { path: 'auth', mixins: [members.defineActions()] },
      defineModelController({
        path: 'members',
        entity: Member,
        authorize: true,
        mixins: [crud],
        actions: {
          'post login': async ({ body: { username, password } }) => {
            const member = await members.verifyLogin(username, password)
            if (!member) throw new HttpError(401)
            await members.login(member)
            return member
          },

          'post register': async ({ body: { username, password }, em }) => {
            const member = em.create(Member, {
              username,
              hash: null,
              roles: []
            })
            await members.setPassword(member, password)
            await em.flush()
            await members.login(member)
            return member
          },

          'post password': async ({ body: { password }, user }) => {
            await members.setPassword(user as Member, password)
          }
        }
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

describe('createUsers() on model controllers', () => {
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
    expect(await self(second)).toBe(undefined)
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

describe('the login methods of the users', () => {
  it('log in through the action of an app', async () => {
    const client = createClient(app.fetch)
    const { status } = await client.post('/members/login', {
      username: 'ada',
      password: 'secret'
    })
    expect(status).toBe(200)
    expect(await self(client)).toEqual({ id: 1, username: 'ada' })
    expect((await load(ada.id)).lastLogin).toBeInstanceOf(Date)
  })

  it('refuse wrong passwords', async () => {
    const client = createClient(app.fetch)
    const { status } = await client.post('/members/login', {
      username: 'ada',
      password: 'wrong'
    })
    expect(status).toBe(401)
    expect((await load(ada.id)).lastLogin).toBe(null)
  })

  it('set the password of an unflushed user', async () => {
    const client = createClient(app.fetch)
    const { status } = await client.post('/members/register', {
      username: 'bob',
      password: '12345678'
    })
    expect(status).toBe(200)
    expect(await self(client)).toMatchObject({ username: 'bob' })
    const bob = await orm.em.fork().findOneOrFail(Member, { username: 'bob' })
    expect(await verifyPassword('12345678', bob.hash)).toBe(true)
  })

  it('keep the session through a change of the own password', async () => {
    const first = await login()
    const second = await login()
    const { status } = await first.post('/members/password', {
      password: 'new secret'
    })
    expect(status).toBe(204)
    expect(await verifyPassword('new secret', (await load(ada.id)).hash)).toBe(
      true
    )
    expect(await self(first)).toEqual({ id: 1, username: 'ada' })
    expect(await self(second)).toBe(undefined)
  })

  it('set passwords outside of requests', async () => {
    const em = orm.em.fork()
    const member = await em.findOneOrFail(Member, ada.id)
    await members.setPassword(member, 'new secret')
    await em.flush()
    expect(await verifyPassword('new secret', (await load(ada.id)).hash)).toBe(
      true
    )
  })

  it('need the session of the users to log in', async () => {
    await expect(members.login(ada)).rejects.toThrow(
      `Unable to log in 'Member' without its session.`
    )
  })
})

describe('defineUserWrites() with confirmed access', () => {
  // A login confirms the access for no time, and `self` is the logged-in user.
  const app = new Hono().route(
    '/',
    createApi({
      adapter,
      users: members,
      controllers: [
        {
          path: 'auth',
          mixins: [members.defineActions({ reconfirmAfter: 0 })]
        },
        defineModelController({
          path: 'members',
          entity: Member,
          authorize: true,
          mixins: [crud],
          resolveId: ({ c, id }) => (id === 'self' ? c.var.user!.id : id)
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

describe('createUsers() on read-only controllers', () => {
  it('adds no routes to the model controllers of the entity', async () => {
    const readOnly = new Hono().route(
      '/',
      createApi({
        adapter,
        users: members,
        controllers: [
          defineModelController({
            path: 'members',
            entity: Member,
            authorize: true,
            actions: { get: true }
          })
        ]
      })
    )
    const response = await readOnly.request('/members/1', { method: 'DELETE' })
    expect(response.status).toBe(404)
  })
})
