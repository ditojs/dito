import type { Context } from 'hono'
import { defineEntity, p } from '@mikro-orm/core'
import { createEntityUserSource } from '../src/user-source.ts'
import { createTestDatabase } from '../../../tests/utils/database.ts'

const AccountSchema = defineEntity({
  name: 'Account',
  tableName: 'account',
  properties: {
    id: p.integer().primary(),
    email: p.string(),
    hash: p.string().nullable(),
    lastLogin: p.datetime().nullable(),
    isActive: p.boolean().default(true)
  }
})
class Account extends AccountSchema.class {}
AccountSchema.setClass(Account)

const DeviceSchema = defineEntity({
  name: 'Device',
  tableName: 'device',
  properties: {
    id: p.uuid().primary(),
    label: p.string(),
    hash: p.string().nullable()
  }
})
class Device extends DeviceSchema.class {}
DeviceSchema.setClass(Device)

const { orm, drop } = await createTestDatabase([Account, Device])

afterAll(drop)

const source = createEntityUserSource(Account, {
  em: () => orm.em,
  usernameProperty: 'email',
  where: { isActive: true },
  serialize: ['id', 'email'],
  computed: { domain: user => user.email.split('@')[1] }
})

// A context outside of the API, and one of a request with its entity manager.
const outside = { var: {} } as Context
const inRequest = (em = orm.em.fork()) =>
  ({ var: { db: em } }) as unknown as Context

let active: Account
let inactive: Account

beforeEach(async () => {
  await orm.em.getConnection().execute('truncate account restart identity')
  const em = orm.em.fork()
  active = em.create(Account, { email: 'a@example.com' })
  inactive = em.create(Account, { email: 'b@example.com', isActive: false })
  await em.flush()
})

describe('createEntityUserSource()', () => {
  it('reads ids by the type of the primary key', async () => {
    const devices = createEntityUserSource(Device, {
      em: () => orm.em,
      usernameProperty: 'label',
      serialize: ['id']
    })
    const id = '6f9619ff-8b86-4d01-b42d-00c04fc964ff'
    const em = orm.em.fork()
    const device = em.create(Device, { id, label: 'Phone' })
    await em.flush()
    expect(await devices.findById(outside, id)).toMatchObject({ id })
    expect(await devices.findById(outside, '1')).toBeNull()
    await devices.patch(outside, device, { hash: 'h' })
    expect(await devices.findById(outside, id)).toMatchObject({ hash: 'h' })
  })

  it('names the users by the entity', () => {
    expect(source.name).toBe('Account')
  })

  it('finds users by integer ids only', async () => {
    expect((await source.findById(outside, String(active.id)))?.email).toBe(
      'a@example.com'
    )
    expect(await source.findById(outside, `${active.id}x`)).toBeNull()
    expect(await source.findById(outside, '')).toBeNull()
    expect(await source.findById(outside, '-1')).toBeNull()
  })

  it('applies `where` to both finds', async () => {
    expect(await source.findById(outside, String(inactive.id))).toBeNull()
    expect(await source.findByUsername(outside, 'b@example.com')).toBeNull()
    expect(
      (await source.findByUsername(outside, 'a@example.com'))?.id
    ).toBe(active.id)
  })

  it(`uses the request's entity manager`, async () => {
    const em = orm.em.fork()
    const user = await source.findById(inRequest(em), String(active.id))
    expect(em.getUnitOfWork().getById(Account, active.id)).toBe(user)
  })

  it('writes patches at once and sets them on the user', async () => {
    const em = orm.em.fork()
    const c = inRequest(em)
    const user = (await source.findById(c, String(active.id)))!
    user.email = 'unflushed@example.com'
    const lastLogin = new Date()
    await source.patch(c, user, { hash: 'h', lastLogin })
    expect(user.hash).toBe('h')
    const stored = await orm.em.fork().findOneOrFail(Account, active.id)
    expect(stored.hash).toBe('h')
    expect(stored.lastLogin?.getTime()).toBe(lastLogin.getTime())
    // The request's other changes stay unflushed.
    expect(stored.email).toBe('a@example.com')
  })

  it('returns the fields and computed values as JSON', async () => {
    const user = (await source.findById(outside, String(active.id)))!
    expect(source.serialize(outside, user)).toEqual({
      id: active.id,
      email: 'a@example.com',
      domain: 'example.com'
    })
  })

  it('takes a function as `serialize`', async () => {
    const custom = createEntityUserSource(Account, {
      em: orm.em,
      serialize: (c, user) => ({ email: user.email })
    })
    const user = (await custom.findById(outside, String(active.id)))!
    expect(custom.serialize(outside, user)).toEqual({ email: 'a@example.com' })
  })

  it('needs `em` outside of the API', async () => {
    const custom = createEntityUserSource(Account, { serialize: ['id'] })
    await expect(custom.findById(outside, '1')).rejects.toThrow(
      'needs `em` outside of the API'
    )
  })
})
