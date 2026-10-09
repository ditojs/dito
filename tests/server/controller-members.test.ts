import type {
  ModelControllerActions,
  ModelProperties,
  ModelScopes
} from '@ditojs/server'
import { Model, ModelController } from '@ditojs/server'
import { createTestApp, getAppUrl } from '../utils/app.js'
import { createTestDatabase } from '../utils/database.js'

class Note extends Model {
  declare id: number
  declare name: string
  declare done: boolean

  static override properties: ModelProperties = {
    name: {
      type: 'string',
      required: true
    },
    done: {
      type: 'boolean'
    }
  }

  static override scopes: ModelScopes<Note> = {
    done: query => query.where('done', true)
  }

  $hasOwner() {
    return true
  }
}

class Notes extends ModelController<Note> {
  override modelClass = Note

  override member: ModelControllerActions<Notes> = {
    'get done-name': {
      parameters: {
        note: {
          from: 'member',
          query: { scope: 'done' }
        }
      },
      handler(ctx: unknown, { note }: { note: Note }) {
        return { name: note.name }
      }
    } as any
  }
}

describe('Controller members', () => {
  const app = createTestApp({
    models: { Note },
    controllers: { Notes }
  })

  beforeAll(async () => {
    await createTestDatabase(app)
    await app.start()
  })

  afterAll(async () => {
    await app.stop()
    await app.knex?.destroy()
  })

  afterEach(async () => {
    await app.knex('Note').del()
  })

  it('applies the `query` option of member parameters', async () => {
    const open = await Note.query().insert({ name: 'Open', done: false })
    const done = await Note.query().insert({ name: 'Done', done: true })
    const url = `${getAppUrl(app)}/notes`
    const openResponse = await fetch(`${url}/${open.id}/done-name`)
    expect(openResponse.status).toBe(404)
    const doneResponse = await fetch(`${url}/${done.id}/done-name`)
    expect(doneResponse.status).toBe(200)
    expect(await doneResponse.json()).toEqual({ name: 'Done' })
  })

  it("doesn't apply the action's query to `$owner` lookups", async () => {
    const open = await Note.query().insert({ name: 'Open', done: false })
    const controller = app.getController('/notes') as Notes
    const authorization = controller.processAuthorize('$owner')
    // The action's own query parameters, e.g. `?scope=done`, are meant for
    // the action, not for the lookup of the member to authorize.
    const ctx: any = {
      state: { user: {} },
      memberId: open.id,
      query: { scope: 'done' },
      filteredQuery: { scope: 'done' },
      transaction: null,
      extend(object: object) {
        return Object.setPrototypeOf(object, this)
      }
    }
    await expect(authorization(ctx)).resolves.toBe(true)
  })
})
