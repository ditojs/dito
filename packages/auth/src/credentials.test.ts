import {
  HttpError,
  createApi,
  defineController,
  defineMixin
} from '@ditojs/server'
import { createCredentials } from './credentials.ts'
import { defineUserWrites } from './passwords.ts'
import {
  createSource,
  createUser,
  type TestUser,
  useTestDatabase
} from './test/helpers.ts'

const getDb = useTestDatabase()

describe('defineUserWrites() with credentials', () => {
  // The API of a controller that deletes `user`, as a model controller does,
  // and fails after that if `isFailing` is set.
  function createUsersApi(user: TestUser, isFailing: boolean) {
    const admins = createSource('Admin', [user])
    const db = getDb()
    const credentials = createCredentials({
      adapter: {
        getKysely: c => (c ? (c.var.em as any).getKysely() : db)
      },
      source: admins
    })
    const users = defineController({
      path: 'users',
      authorize: true,
      mixins: [
        defineMixin({ actions: { 'delete :id': () => ({ count: 1 }) } }),
        defineUserWrites({ source: admins, credentials }),
        defineMixin({
          actions: {
            async 'delete :id'({ c, next }) {
              c.set('getRecord', async () => user)
              const result = await next()
              // Rolls the transaction back:
              if (isFailing) throw new HttpError(409)
              return result
            }
          }
        })
      ]
    })
    const api = createApi({
      controllers: [users],
      // Request handles with a Kysely, as the entity managers of
      // `@ditojs/mikro` have.
      adapter: {
        connect: () => ({ getKysely: () => db }),
        transact: (c, fn) =>
          db.transaction().execute(trx => {
            c.set('em', { getKysely: () => trx })
            return fn()
          })
      },
      onError: () => {}
    })
    return { api, credentials }
  }

  it('deletes the credentials of a deleted user', async () => {
    const ada = await createUser(1, 'ada', null)
    const bob = await createUser(2, 'bob', null)
    const { api, credentials } = createUsersApi(ada, false)
    await credentials.insert(ada, 'totp', { data: {} })
    await credentials.insert(bob, 'totp', { data: {} })
    const response = await api.request('/users/1', { method: 'DELETE' })
    expect(response.status).toBe(200)
    expect(await credentials.findFirst(ada, 'totp')).toBe(null)
    expect(await credentials.findFirst(bob, 'totp')).not.toBe(null)
  })

  it('deletes in the transaction of the request', async () => {
    const ada = await createUser(1, 'ada', null)
    const { api, credentials } = createUsersApi(ada, true)
    await credentials.insert(ada, 'totp', { data: {} })
    const response = await api.request('/users/1', { method: 'DELETE' })
    expect(response.status).toBe(409)
    expect(await credentials.findFirst(ada, 'totp')).not.toBe(null)
  })
})
