import { vi } from 'vitest'
import { Application } from '../../app/Application.js'
import { Model, SessionModel } from '../../models/index.js'
import { deleteExpiredRecords } from './deleteExpiredRecords.js'
import { createTestKnex } from '../../../../../tests/utils/test-knex.ts'
import { createTestDatabase } from '../../../../../tests/utils/database.ts'

describe('deleteExpiredRecords()', () => {
  it('sets up the app and deletes its expired records', async () => {
    class Session extends SessionModel {}
    const app = new Application({
      config: { log: { silent: true }, knex: createTestKnex() },
      models: { Session }
    })
    // Freeze the time, so that the valid session can't expire meanwhile:
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      await createTestDatabase(app)
      await Session.query().insert([
        { id: 'expired', value: {}, expiresAt: new Date(Date.now() - 1000) },
        { id: 'valid', value: {}, expiresAt: new Date(Date.now() + 1000) }
      ])
      expect(await deleteExpiredRecords(app)).toBe(true)
      expect(Session.isInitialized).toBe(true)
      expect((await Session.query()).map(session => session.id)).toEqual([
        'valid'
      ])
    } finally {
      vi.useRealTimers()
      await app.knex.destroy()
    }
  })

  it('throws the errors', async () => {
    class Pantry extends Model {
      static async deleteExpiredRecords() {
        throw new Error('Pantry is locked')
      }
    }
    const app = new Application({
      config: { log: { silent: true } },
      models: { Pantry }
    })
    await expect(deleteExpiredRecords(app)).rejects.toMatchObject({
      message: 'Unable to delete all expired records.',
      errors: [new Error('Pantry is locked')]
    })
  })
})
