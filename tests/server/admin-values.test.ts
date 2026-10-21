import type { ModelProperties } from '@ditojs/server'
import { Model, ModelController, ValidationError } from '@ditojs/server'
import { createTestApp, getAppUrl } from '../utils/app.js'
import { createClient } from '../utils/client.js'
import { createTestDatabase } from '../utils/database.js'
import { isSQLiteTest } from '../utils/test-knex.js'

// What the server accepts of the values that the admin's fields send, through
// the requests that the admin saves with: POST to create, PATCH to edit.

class Event extends Model {
  declare id: number
  declare day: Date | null

  static override properties: ModelProperties = {
    title: { type: 'string', required: true },
    subtitle: { type: 'string', required: true, nullable: true },
    note: { type: 'string' },
    email: { type: 'string', format: 'email' },
    isPublic: { type: 'boolean' },
    day: { type: 'date', nullable: true },
    opensAt: { type: 'datetime', nullable: true },
    opensAtTime: { type: 'string', format: 'iso-time', nullable: true },
    pages: { type: 'integer', nullable: true },
    color: { type: 'color', nullable: true },
    tags: { type: 'array', items: { type: 'string' }, required: true },
    details: { type: 'object', required: true }
  }
}

class Events extends ModelController<Event> {
  override modelClass = Event
  override collection: any = { allow: ['post'] }
  override member: any = { allow: ['patch'] }
}

describe('Values that the admin sends', () => {
  const app = createTestApp({ models: { Event }, controllers: { Events } })
  const valid = { title: 'Opening', subtitle: null, tags: [], details: {} }
  let request: ReturnType<typeof createClient>

  const create = (values: object) =>
    request('/events', { method: 'POST', body: { ...valid, ...values } })

  const edit = async (values: object) => {
    const { data } = await create({})
    return request(`/events/${data.id}`, { method: 'PATCH', body: values })
  }

  beforeAll(async () => {
    await createTestDatabase(app)
    await app.start()
    request = createClient(getAppUrl(app))
  })

  afterAll(async () => {
    await app.stop()
    await app.knex?.destroy()
  })

  describe('checkbox', () => {
    it('saves booleans', async () => {
      expect(await create({ isPublic: true })).toMatchObject({
        status: 201,
        data: { isPublic: true }
      })
    })

    // New checkboxes send `null`, which booleans only accept when they're
    // nullable, and `false` with `nullable: false`:
    it('saves `false` and rejects `null` for booleans', async () => {
      expect(await create({ isPublic: false })).toMatchObject({
        status: 201,
        data: { isPublic: false }
      })
      expect(await create({ isPublic: null })).toMatchObject({
        status: 400,
        data: { errors: { isPublic: [{ message: 'must be a boolean' }] } }
      })
    })
  })

  describe('date', () => {
    it('saves plain dates as the admin sends them', async () => {
      expect(await create({ day: '2026-05-14' })).toMatchObject({
        status: 201,
        data: { day: '2026-05-14' }
      })
      expect((await edit({ day: '2026-05-15' })).data).toMatchObject({
        day: '2026-05-15'
      })
    })

    // Current behaviour, a mismatch with the requests, which validate after
    // parsing: async validation checks plain dates as strings, where `date`
    // requires a date-time:
    it('rejects plain dates in async validation', async () => {
      await expect(
        Event.fromJson({ ...valid, day: '2026-05-14' }, { async: true })
      ).rejects.toThrow(ValidationError)
      await expect(
        Event.fromJson(
          { ...valid, day: '2026-05-14T00:00:00.000Z' },
          { async: true }
        )
      ).resolves.toBeInstanceOf(Event)
    })

    // Current behaviour, a bug: the requests validate dates after parsing
    // them, so strings that aren't dates pass as invalid dates, which SQLite
    // stores:
    it('passes strings that are no dates to the database', async () => {
      expect(Event.fromJson({ ...valid, day: 'soon' }).day?.getTime()).toBeNaN()
      expect(await create({ day: 'soon' })).toMatchObject(
        isSQLiteTest
          ? { status: 201, data: { day: '0NaN-NaN-NaN' } }
          : { status: 400, data: { type: 'DataError' } }
      )
    })
  })

  describe('time', () => {
    // The admin's time type sends full ISO date-times, e.g. for 14:30 today:
    const time = new Date(2026, 4, 14, 14, 30).toISOString()

    it('saves the times of the admin as date-times', async () => {
      expect(await create({ opensAt: time })).toMatchObject({
        status: 201,
        data: { opensAt: time }
      })
    })

    // Current behaviour, a mismatch with the admin: the time formats reject
    // the date-times that the admin's time type sends:
    it('rejects the times of the admin in time formats', async () => {
      expect(await create({ opensAtTime: time })).toMatchObject({
        status: 400,
        data: {
          errors: {
            opensAtTime: [{ message: 'must match format "iso-time"' }]
          }
        }
      })
      expect((await create({ opensAtTime: '14:30:00' })).status).toBe(201)
    })

    // Current behaviour, a mismatch with the admin: the admin sends times
    // written by code unchanged, e.g. '14:30', which date-times pass as
    // invalid dates:
    it('fails to save the times written by code as date-times', async () => {
      expect(await create({ opensAt: '14:30' })).toMatchObject({
        status: 500,
        data: { message: 'Invalid time value' }
      })
    })
  })

  describe('color', () => {
    it('saves the hex colors of the admin', async () => {
      expect(await create({ color: '#ff000080' })).toMatchObject({
        status: 201,
        data: { color: '#ff000080' }
      })
    })

    // The admin's `rgb`, `prgb`, `hsl` and `hsv` formats send objects, which
    // need `type: 'object'`, as documented in the upgrade guide to 4.x:
    it('rejects the color objects of the admin', async () => {
      expect(
        await create({ color: { r: 255, g: 0, b: 0, a: 1 } })
      ).toMatchObject({
        status: 400,
        data: { errors: { color: [{ message: 'must be a string' }] } }
      })
    })
  })

  describe('required', () => {
    // Current behaviour, a mismatch with the admin: the admin's `required`
    // rejects empty lists, the server's accepts them, and empty objects:
    it('accepts empty arrays and objects', async () => {
      expect(await create({ tags: [], details: {} })).toMatchObject({
        status: 201,
        data: { tags: [], details: {} }
      })
    })

    it('rejects empty strings and `null` on create', async () => {
      expect(await create({ title: '' })).toMatchObject({
        status: 400,
        data: { errors: { title: [{ message: 'is required' }] } }
      })
      expect(await create({ title: null })).toMatchObject({
        status: 400,
        data: { errors: { title: [{ message: 'must be a string' }] } }
      })
    })

    // Current behaviour, a mismatch with the admin: PATCH doesn't check
    // `required`, where the admin's `required` rejects empty strings:
    it('accepts empty strings on edit', async () => {
      expect(await edit({ title: '' })).toMatchObject({
        status: 200,
        data: { title: '' }
      })
    })
  })

  describe('empty values', () => {
    // Emptied string fields with `nullable: false` send `''`:
    it('saves empty strings for strings', async () => {
      expect(await edit({ note: '' })).toMatchObject({
        status: 200,
        data: { note: '' }
      })
    })

    // Formats don't apply to empty strings, only `required` checks emptiness:
    it('saves empty strings for strings with formats', async () => {
      expect(await edit({ email: '' })).toMatchObject({
        status: 200,
        data: { email: '' }
      })
      expect(await edit({ email: 'ada' })).toMatchObject({
        status: 400,
        data: { errors: { email: [{ message: 'must match format "email"' }] } }
      })
    })

    it('accepts `null` for nullable properties', async () => {
      expect((await create({ subtitle: null })).status).toBe(201)
      expect((await edit({ subtitle: null })).status).toBe(200)
    })

    // Emptied fields send `null`, which only nullable properties accept:
    it('rejects `null` for properties that are not nullable', async () => {
      expect(await edit({ note: null, tags: null })).toMatchObject({
        status: 400,
        data: {
          errors: {
            note: [{ message: 'must be a string' }],
            tags: [{ message: 'must be a list' }]
          }
        }
      })
    })

    it('rejects empty strings for other types than strings', async () => {
      expect(await edit({ note: '', pages: '' })).toMatchObject({
        status: 400,
        data: { errors: { pages: [{ message: 'must be a whole number' }] } }
      })
    })
  })
})
