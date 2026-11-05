import { createCredentials } from '../src/index.ts'
import { createSource, createUser, useTestDatabase } from './helpers.ts'

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
})
