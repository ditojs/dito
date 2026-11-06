import { Hono } from 'hono'
import { contextStorage } from 'hono/context-storage'
import type { EntityManager } from '@mikro-orm/core'
import { z } from 'zod'
import { defineEntity, p } from '@mikro-orm/core'
import {
  createEntityUserSource,
  defaultPasswordSchema
} from './createEntityUserSource.ts'
import { createMikroAdapter } from './createMikroAdapter.ts'
import { createTestDatabase } from '../../../tests/utils/database.ts'

const AccountSchema = defineEntity({
  name: 'Account',
  tableName: 'account',
  properties: {
    id: p.integer().primary(),
    email: p.string(),
    hash: p.string().nullable().hidden(),
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
    hash: p.string().nullable().hidden()
  }
})
class Device extends DeviceSchema.class {}
DeviceSchema.setClass(Device)

// A user entity that sends its hash out.
const VisitorSchema = defineEntity({
  name: 'Visitor',
  tableName: 'visitor',
  properties: {
    id: p.integer().primary(),
    username: p.string(),
    hash: p.string().nullable()
  }
})
class Visitor extends VisitorSchema.class {}
VisitorSchema.setClass(Visitor)

const { orm, drop } = await createTestDatabase([Account, Device, Visitor])

afterAll(drop)

const adapter = createMikroAdapter(orm)

const source = createEntityUserSource(Account, {
  adapter,
  usernameProperty: 'email',
  where: { isActive: true },
  serialize: ['id', 'email'],
  computed: { domain: ({ user }) => user.email.split('@')[1] }
})

// Runs `fn` in a request with `em` as its entity manager.
async function inRequest(em: EntityManager, fn: () => Promise<unknown>) {
  const app = new Hono()
    .use(contextStorage())
    .get('/', async c => {
      c.set('em', em)
      await fn()
      return c.body(null)
    })
  const response = await app.request('/')
  expect(response.status).toBe(200)
}

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
      adapter,
      usernameProperty: 'label',
      serialize: ['id']
    })
    const id = '6f9619ff-8b86-4d01-b42d-00c04fc964ff'
    const em = orm.em.fork()
    const device = em.create(Device, { id, label: 'Phone' })
    await em.flush()
    expect(await devices.findById(id)).toMatchObject({ id })
    expect(await devices.findById('1')).toBeNull()
    await devices.patch(device, { hash: 'h' })
    expect(await devices.findById(id)).toMatchObject({ hash: 'h' })
  })

  it('refuses entities that send their hash out', async () => {
    const visitors = createEntityUserSource(Visitor, {
      adapter,
      serialize: ['id']
    })
    const message = `Invalid user entity 'Visitor': its 'hash' isn't hidden`
    await expect(visitors.findById('1')).rejects.toThrow(message)
    await expect(visitors.findByUsername('a')).rejects.toThrow(message)
  })

  it('names the users by the entity', () => {
    expect(source.name).toBe('Account')
  })

  it('finds users by integer ids only', async () => {
    expect((await source.findById(String(active.id)))?.email).toBe(
      'a@example.com'
    )
    expect(await source.findById(`${active.id}x`)).toBeNull()
    expect(await source.findById('')).toBeNull()
    expect(await source.findById('-1')).toBeNull()
  })

  it('applies `where` to both finds', async () => {
    expect(await source.findById(String(inactive.id))).toBeNull()
    expect(await source.findByUsername('b@example.com')).toBeNull()
    expect(
      (await source.findByUsername('a@example.com'))?.id
    ).toBe(active.id)
  })

  it(`uses the request's entity manager`, async () => {
    const em = orm.em.fork()
    await inRequest(em, async () => {
      const user = await source.findById(String(active.id))
      expect(em.getUnitOfWork().getById(Account, active.id)).toBe(user)
    })
  })

  it('writes patches at once and sets them on the user', async () => {
    const em = orm.em.fork()
    const lastLogin = new Date()
    await inRequest(em, async () => {
      const user = (await source.findById(String(active.id)))!
      user.email = 'unflushed@example.com'
      await source.patch(user, { hash: 'h', lastLogin })
      expect(user.hash).toBe('h')
    })
    const stored = await orm.em.fork().findOneOrFail(Account, active.id)
    expect(stored.hash).toBe('h')
    expect(stored.lastLogin?.getTime()).toBe(lastLogin.getTime())
    // The request's other changes stay unflushed.
    expect(stored.email).toBe('a@example.com')
  })

  it('returns the fields and computed values as JSON', async () => {
    const user = (await source.findById(String(active.id)))!
    expect(source.serialize(user)).toEqual({
      id: active.id,
      email: 'a@example.com',
      domain: 'example.com'
    })
  })

  it('holds the schema of new passwords', () => {
    const password = z.string().min(12)
    expect(source.password).toBe(defaultPasswordSchema)
    expect(
      createEntityUserSource(Account, { adapter, serialize: ['id'], password })
        .password
    ).toBe(password)
  })

  it('serializes the entity without hidden properties by default', async () => {
    const source = createEntityUserSource(Account, {
      adapter,
      usernameProperty: 'email',
      computed: { label: ({ user }) => user.email.toUpperCase() }
    })
    const user = (await source.findByUsername('a@example.com'))!
    expect(source.serialize(user)).toEqual({
      id: user.id,
      email: 'a@example.com',
      lastLogin: null,
      isActive: true,
      label: 'A@EXAMPLE.COM'
    })
  })

  it('takes a function as `serialize`', async () => {
    const custom = createEntityUserSource(Account, {
      adapter,
      serialize: ({ user }) => ({ email: user.email })
    })
    const user = (await custom.findById(String(active.id)))!
    expect(custom.serialize(user)).toEqual({ email: 'a@example.com' })
  })
})
