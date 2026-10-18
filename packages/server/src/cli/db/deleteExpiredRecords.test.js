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
      await app.knex.destroy()
    }
  })

  it('logs the errors and fails', async () => {
    class Pantry extends Model {
      static async deleteExpiredRecords() {
        throw new Error('Pantry is locked')
      }
    }
    const app = new Application({
      config: { log: { silent: true } },
      models: { Pantry }
    })
    const logError = vi.spyOn(app, 'logError').mockImplementation(() => {})
    expect(await deleteExpiredRecords(app)).toBe(false)
    expect(logError).toHaveBeenCalledExactlyOnceWith(
      new Error('Pantry is locked')
    )
  })
})
