import type { Kysely } from 'kysely'
import { z } from 'zod'
import { defineMixin, HttpError, type Handler } from '@ditojs/server'
import { definePasswordWrites, verifyPassword } from './index.ts'
import {
  createSource,
  createUser,
  setup,
  type TestUser,
  useTestDatabase
} from './test/helpers.ts'
import { createClient } from '../../../tests/utils/client.ts'

const getDb = useTestDatabase()
let db: Kysely<any>
let ada: TestUser
let users: TestUser[]
let admins: ReturnType<typeof createSource>
// The bodies that reach the handlers beneath `definePasswordWrites()`.
let bodies: unknown[]

beforeEach(async () => {
  db = getDb()
  ada = await createUser(1, 'ada', 'secret')
  users = [ada, await createUser(2, 'bob', 'secret')]
  admins = createSource('Admin', users)
  bodies = []
})

// The default handlers of an ORM's controller, on the users in memory.
const crud = defineMixin({
  actions: {
    'post': ({ body }) => {
      bodies.push(body)
      const user = { id: users.length + 1, ...body } as TestUser
      users.push(user)
      return user
    },
    'patch :id': (({ body, params }) => {
      bodies.push(body)
      const user = users.find(user => String(user.id) === params.id)
      return Object.assign(user!, body)
    }) as Handler
  }
})

function createApp(password?: z.ZodType<string>) {
  const source = { ...admins, password }
  const { api } = setup({
    db,
    source: admins,
    controllers: [
      {
        path: 'users',
        authorize: true,
        mixins: [crud, definePasswordWrites({ source })]
      }
    ]
  })
  return api
}

describe('definePasswordWrites()', () => {
  it('hashes the password of new users', async () => {
    const client = createClient(createApp().fetch)
    const { status } = await client.post('/users', {
      username: 'cy',
      password: '12345678'
    })
    expect(status).toBe(200)
    expect(bodies).toEqual([{ username: 'cy' }])
    expect(await verifyPassword('12345678', users[2]!.hash)).toBe(true)
  })

  it('checks the password with the schema', async () => {
    const client = createClient(createApp().fetch)
    const response = await client.post('/users', {
      username: 'cy',
      password: 'short'
    })
    expect(response).toMatchObject({
      status: 400,
      data: {
        type: 'BodyValidation',
        errors: { password: [{ keyword: 'too_small' }] }
      }
    })
    const custom = createClient(createApp(z.string().min(4)).fetch)
    expect(
      (await custom.post('/users', { username: 'cy', password: 'short' }))
        .status
    ).toBe(200)
  })

  it('rejects a hash in the body', async () => {
    const client = createClient(createApp().fetch)
    const response = await client.request('PATCH', '/users/2', { hash: 'x' })
    expect(response).toMatchObject({
      status: 400,
      data: { errors: { hash: [expect.any(Object)] } }
    })
    expect(bodies).toEqual([])
  })

  it('passes bodies without a password on', async () => {
    const client = createClient(createApp().fetch)
    await client.request('PATCH', '/users/2', { username: 'bo' })
    expect(bodies).toEqual([{ username: 'bo' }])
    expect(await verifyPassword('secret', users[1]!.hash)).toBe(true)
  })

  it('keeps the session of users who change their own password', async () => {
    const api = createApp()
    const first = createClient(api.fetch)
    const second = createClient(api.fetch)
    for (const client of [first, second]) {
      await client.post('/admins/login', {
        username: 'ada',
        password: 'secret'
      })
    }
    const response = await first.request('PATCH', '/users/1', {
      password: 'new secret'
    })
    expect(response.status).toBe(200)
    expect((await first.get('/admins/self')).data).not.toBe(null)
    expect((await second.get('/admins/self')).data).toBe(null)
  })

  it('keeps the session when the write fails', async () => {
    const hash = ada.hash
    // Fails after the handlers, as a flush does, and rolls the user back.
    const failing = defineMixin({
      actions: {
        'patch :id': (async ({ next }) => {
          await next()
          ada.hash = hash
          throw new HttpError(409)
        }) as Handler
      }
    })
    const { api } = setup({
      db,
      source: admins,
      controllers: [
        {
          path: 'users',
          authorize: true,
          mixins: [crud, definePasswordWrites({ source: admins }), failing]
        }
      ]
    })
    const client = createClient(api.fetch)
    await client.post('/admins/login', { username: 'ada', password: 'secret' })
    const response = await client.request('PATCH', '/users/1', {
      password: 'new secret'
    })
    expect(response.status).toBe(409)
    expect((await client.get('/admins/self')).data).not.toBe(null)
  })

  it(`ends the sessions of other users' changed passwords`, async () => {
    const api = createApp()
    const admin = createClient(api.fetch)
    const bob = createClient(api.fetch)
    await admin.post('/admins/login', { username: 'ada', password: 'secret' })
    await bob.post('/admins/login', { username: 'bob', password: 'secret' })
    await admin.request('PATCH', '/users/2', { password: 'new secret' })
    expect((await admin.get('/admins/self')).data).not.toBe(null)
    expect((await bob.get('/admins/self')).data).toBe(null)
  })
})
