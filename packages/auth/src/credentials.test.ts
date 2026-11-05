import { HttpError, createApi, defineController } from '@ditojs/server'
import { createCredentials } from './index.ts'
import { createSource, createUser, useTestDatabase } from './test/helpers.ts'

const getDb = useTestDatabase()

describe('createCredentials()', () => {
  it('deletes the credentials of users', async () => {
    const ada = await createUser(1, 'ada', null)
    const bob = await createUser(2, 'bob', null)
    const admins = createSource('Admin', [ada, bob])
    const db = getDb()
    const credentials = createCredentials({ adapter: { getKysely: () => db } })
    await credentials.insert(admins, ada, 'totp', { data: {} })
    await credentials.insert(admins, bob, 'totp', { data: {} })
    await credentials.deleteUsers(admins, [1])
    expect(await credentials.findFirst(admins, ada, 'totp')).toBe(null)
    expect(await credentials.findFirst(admins, bob, 'totp')).not.toBe(null)
  })

  it('deletes in the transaction of the request', async () => {
    const ada = await createUser(1, 'ada', null)
    const admins = createSource('Admin', [ada])
    const db = getDb()
    const credentials = createCredentials({ adapter: { getKysely: () => db } })
    await credentials.insert(admins, ada, 'totp', { data: {} })
    const users = defineController({
      path: 'users',
      authorize: true,
      actions: {
        async 'delete :id'({ params, c }) {
          await credentials.deleteUsers(admins, [params.id], { c })
          // Rolls the transaction back:
          throw new HttpError(409)
        }
      }
    })
    const api = createApi({
      controllers: [users],
      // Request handles with a Kysely, as the entity managers of
      // `@ditojs/mikro` have.
      adapter: {
        connect: () => ({ getKysely: () => db }),
        transaction: (c, fn) =>
          db.transaction().execute(trx => {
            c.set('em', { getKysely: () => trx })
            return fn()
          })
      },
      onError: () => {}
    })
    const response = await api.request('/users/1', { method: 'DELETE' })
    expect(response.status).toBe(409)
    expect(await credentials.findFirst(admins, ada, 'totp')).not.toBe(null)
  })
})
