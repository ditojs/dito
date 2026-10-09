import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'
import {
  createTestApp,
  createTestDatabase,
  destroyTestApp
} from './setup.js'

const receivedValues: unknown[] = []

// The function form, with the parameters passed as separate arguments.
function tagged(query: any, tag: unknown) {
  receivedValues.push(tag)
}
tagged.parameters = [{ name: 'tag', type: 'object' }]

class Event extends Model {
  declare id: number
  declare name: string

  static override properties: ModelProperties = {
    name: {
      type: 'string'
    }
  }

  static override filters = {
    since: {
      parameters: {
        date: { type: 'date' }
      },
      handler(query: any, { date }: { date: unknown }) {
        receivedValues.push(date)
      }
    },

    tagged
  } as any
}

describe('Model filters', () => {
  const app = createTestApp({ models: { Event } })

  beforeAll(async () => {
    await createTestDatabase(app)
    await app.setup()
  })

  afterAll(async () => {
    await destroyTestApp(app)
  })

  afterEach(() => {
    receivedValues.length = 0
  })

  it('coerces date parameters', async () => {
    await Event.query().applyFilter('since', '2020-01-01')
    expect(receivedValues).toEqual([new Date('2020-01-01')])
  })

  it('coerces object parameters from Dito.js object notation', async () => {
    await Event.query().applyFilter('tagged', 'name:news,priority:1')
    expect(receivedValues).toEqual([{ name: 'news', priority: 1 }])
  })

  it('rejects invalid parameters', async () => {
    await expect(
      Event.query().applyFilter('tagged', '"broken')
    ).rejects.toThrow(/query filter 'tagged' is not valid/)
  })
})
