import { defineEntity, p } from '@mikro-orm/core'
import { createRecord, mikroOptions } from '../src/index.ts'
import { createTestDatabase } from '../../../tests/utils/database.ts'

const EventSchema = defineEntity({
  name: 'Event',
  tableName: 'event',
  properties: {
    id: p.integer().primary(),
    day: p.date().nullable()
  }
})
class Event extends EventSchema.class {}
EventSchema.setClass(Event)

const { orm, sql, drop } = await createTestDatabase([Event], mikroOptions)

afterAll(drop)

beforeEach(() => sql('truncate event restart identity'))

// The tests run in Europe/Zurich, so 00:30 is still the day before in UTC.
const date = new Date(2026, 4, 14, 0, 30)

const stored = async () => {
  const [row] = await sql(`select day::text from event`)
  return row.day
}

describe('`date` columns with `mikroOptions()`', () => {
  it('stores a `Date` as its local day', async () => {
    const em = orm.em.fork()
    em.create(Event, { day: date as never })
    await em.flush()
    expect(await stored()).toBe('2026-05-14')
  })

  it('stores a string with a time as its local day', async () => {
    const em = orm.em.fork()
    await createRecord(em, Event, { day: date.toISOString() })
    await em.flush()
    expect(await stored()).toBe('2026-05-14')
  })

  it('stores a plain date as it is', async () => {
    const em = orm.em.fork()
    await createRecord(em, Event, { day: '2026-05-14' })
    await em.flush()
    expect(await stored()).toBe('2026-05-14')
  })

  it('reads as `YYYY-MM-DD`, also in queries with a `Date`', async () => {
    const em = orm.em.fork()
    em.create(Event, { day: '2026-05-14' })
    await em.flush()
    const row = await orm.em.fork().findOneOrFail(Event, { day: date as never })
    expect(row.day).toBe('2026-05-14')
  })

  it('leaves invalid values to Postgres', async () => {
    const em = orm.em.fork()
    em.create(Event, { day: 'never' })
    await expect(em.flush()).rejects.toThrow(/invalid input syntax/)
    const invalid = orm.em.fork()
    invalid.create(Event, { day: 'neverT' })
    await expect(invalid.flush()).rejects.toThrow(/invalid input syntax/)
  })
})
