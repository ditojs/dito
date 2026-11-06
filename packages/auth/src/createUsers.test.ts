import { defineEntity, p } from '@mikro-orm/core'
import { createApi } from '@ditojs/server'
import { createMikroAdapter } from '@ditojs/mikro'
import { createUsers, hashPassword } from './index.ts'
import { createClient } from '../../../tests/utils/client.ts'
import { createTestDatabase } from '../../../tests/utils/database.ts'
import { Credential, Session } from '../../../tests/utils/entities.ts'

// Users of a real entity, whose username is its `email`, without `username` and
// `lastLogin` properties.
const MemberSchema = defineEntity({
  name: 'Member',
  properties: {
    id: p.integer().primary(),
    email: p.string().unique(),
    hash: p.string().nullable().hidden(),
    roles: p.json<string[]>().nullable()
  }
})
class Member extends MemberSchema.class {}
MemberSchema.setClass(Member)

const { orm, drop } = await createTestDatabase([Member, Session, Credential])

afterAll(drop)

const adapter = createMikroAdapter(orm)
const send = vi.fn()

const members = createUsers(Member, {
  adapter,
  secrets: ['secret sauce'],
  session: { expiresAfter: 60_000 },
  usernameProperty: 'email'
})

const api = createApi({
  adapter,
  users: members,
  controllers: [
    {
      path: 'members',
      mixins: [
        members.defineActions({
          name: 'Dito',
          passkeys: true,
          totp: { secret: 'a long secret' },
          passwordReset: { confirmUrl: 'https://example.com/{token}', send }
        })
      ]
    },
    {
      path: 'requests',
      actions: {
        'get user': async ({ user, session }) => ({
          isEntity: user instanceof Member,
          isSessionUser: user === (await session.getUser())
        }),
        'get self': ({ user }) => user,
        'get editor': { authorize: 'editor', handler: () => 'ok' }
      }
    }
  ]
})

const email = 'ada@example.com'
let client: ReturnType<typeof createClient>

beforeEach(async () => {
  await orm.em.getConnection().execute(
    'truncate member, session, credential restart identity'
  )
  send.mockClear()
  const em = orm.em.fork()
  em.create(Member, { email, hash: await hashPassword('secret'), roles: [] })
  await em.flush()
  client = createClient(api.fetch)
})

const login = () =>
  client.post('/members/login', { username: email, password: 'secret' })

describe('defineActions()', () => {
  it('needs a `name` for passkeys and TOTP', () => {
    expect(() => members.defineActions({ passkeys: true })).toThrow(
      'Unable to use passkeys without a `name`.'
    )
    expect(() => members.defineActions({ totp: { secret: 'long' } })).toThrow(
      'Unable to use TOTP without a `name`.'
    )
  })
})

describe('the session cookie', () => {
  it('takes its name from the entity', async () => {
    await login()
    expect(client.jar.has('member.sess')).toBe(true)
  })
})

describe('the user of a request', () => {
  it('is the entity of the session', async () => {
    await login()
    const { data } = await client.get('/requests/user')
    expect(data).toEqual({ isEntity: true, isSessionUser: true })
  })

  it('leaves out the hash when a handler returns it', async () => {
    await login()
    const { data } = await client.get('/requests/self')
    expect(data).toEqual({ id: 1, email, roles: [] })
  })

  it('has no roles without a value in `roles`', async () => {
    await orm.em.fork().nativeUpdate(Member, { id: 1 }, { roles: null })
    await login()
    expect((await client.get('/requests/editor')).status).toBe(403)
  })

  it('reads the user once per request', async () => {
    await login()
    const findOne = vi.spyOn(orm.em.getDriver(), 'findOne')
    await client.get('/requests/user')
    expect(findOne).toHaveBeenCalledTimes(1)
    findOne.mockRestore()
  })
})

describe('createUsers() with `usernameProperty`', () => {
  it('logs in users of an entity without `lastLogin`', async () => {
    const { status, data } = await login()
    expect(status).toBe(200)
    expect(data.user.email).toBe(email)
  })

  it('names the passkeys after the username', async () => {
    await login()
    const { data } = await client.post('/members/passkey-options')
    expect(data.user.name).toBe(email)
  })

  it('labels the TOTP secrets with the username', async () => {
    await login()
    const { data } = await client.post('/members/totp')
    expect(decodeURIComponent(data.uri)).toContain(`Dito:${email}?`)
  })

  it('ends the reset links when the username changes', async () => {
    await client.post('/members/password-reset', { username: email })
    const { url } = send.mock.calls[0]![0]
    const token = url.slice(url.lastIndexOf('/') + 1)
    await orm.em.fork().nativeUpdate(
      Member,
      { id: 1 },
      {
        email: 'grace@example.com'
      }
    )
    const { status } = await client.post('/members/password-reset-confirm', {
      token,
      password: 'new secret'
    })
    expect(status).toBe(400)
  })
})
