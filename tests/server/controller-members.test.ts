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

// Hides the archived notes from all member lookups by overriding `member.get`,
// passing on only `ctx` and `modify` to `super.get()`.
class ActiveNotes extends ModelController<Note> {
  override modelClass = Note

  override member: ModelControllerActions<ActiveNotes> = {
    'get'(ctx: any, modify: any) {
      return super.get(ctx, (query: any) => {
        query.whereNot('name', 'Archived')
        query.modify(modify)
      })
    },

    'get name': {
      parameters: {
        note: {
          from: 'member'
        }
      },
      handler(ctx: unknown, { note }: { note: Note }) {
        return { name: note.name }
      }
    },

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
    },

    'get locked-name': {
      transacted: true,
      parameters: {
        note: {
          from: 'member',
          forUpdate: true
        }
      },
      handler(ctx: unknown, { note }: { note: Note }) {
        return { name: note.name }
      }
    },

    'get unlocked-name': {
      parameters: {
        note: {
          from: 'member',
          forUpdate: true
        }
      },
      handler(ctx: unknown, { note }: { note: Note }) {
        return { name: note.name }
      }
    }
  } as any
}

// Hides the archived notes like `ActiveNotes`, but through a `member.get`
// override in object notation that sub-classes don't route.
class UnarchivedNotesBase extends ModelController<Note> {
  override modelClass = Note

  override member: ModelControllerActions<UnarchivedNotesBase> = {
    get: {
      handler(ctx: any, modify: any) {
        return super.get(ctx, (query: any) => {
          query.whereNot('name', 'Archived')
          query.modify(modify)
        })
      }
    }
  } as any
}

class UnarchivedNotes extends UnarchivedNotesBase {
  override member: ModelControllerActions<UnarchivedNotes> = {
    'allow': ['get name'],

    'get name': {
      parameters: {
        note: {
          from: 'member'
        }
      },
      handler(ctx: unknown, { note }: { note: Note }) {
        return { name: note.name }
      }
    }
  } as any
}

// Routes the `member.get` override that it inherits from the intermediate
// `UnarchivedNotesBase`, which shares its definition with `UnarchivedNotes`.
class UnarchivedNamedNotes extends UnarchivedNotesBase {
  override member: ModelControllerActions<UnarchivedNamedNotes> = {
    'get name': {
      parameters: {
        note: {
          from: 'member'
        }
      },
      handler(ctx: unknown, { note }: { note: Note }) {
        return { name: note.name }
      }
    }
  } as any
}

// Hides the notes named by a controller field from all member lookups, read
// in the `member.get` override through `this.controller`, as routed handlers
// receive the member actions object as `this`, not the controller.
class ConfiguredNotes extends ModelController<Note> {
  override modelClass = Note
  hiddenName = 'Archived'

  override member: ModelControllerActions<ConfiguredNotes> = {
    'get'(ctx: any, modify: any) {
      const { hiddenName } = this.controller
      return super.get(ctx, (query: any) => {
        query.whereNot('name', hiddenName)
        query.modify(modify)
      })
    },

    'get name': {
      parameters: {
        note: {
          from: 'member'
        }
      },
      handler(ctx: unknown, { note }: { note: Note }) {
        return { name: note.name }
      }
    }
  } as any
}

describe('Controller members', () => {
  const app = createTestApp({
    models: { Note },
    controllers: {
      Notes,
      ActiveNotes,
      UnarchivedNotes,
      UnarchivedNamedNotes,
      ConfiguredNotes
    }
  })

  function createOwnerContext(memberId: number) {
    return {
      state: { user: {} },
      memberId,
      query: {},
      filteredQuery: {},
      transaction: null,
      extend(object: object) {
        return Object.setPrototypeOf(object, this)
      }
    }
  }

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

  it("resolves `from: 'member'` parameters through `member.get`", async () => {
    const active = await Note.query().insert({ name: 'Active' })
    const archived = await Note.query().insert({ name: 'Archived' })
    const url = `${getAppUrl(app)}/active-notes`
    const archivedResponse = await fetch(`${url}/${archived.id}/name`)
    expect(archivedResponse.status).toBe(404)
    const activeResponse = await fetch(`${url}/${active.id}/name`)
    expect(activeResponse.status).toBe(200)
    expect(await activeResponse.json()).toEqual({ name: 'Active' })
  })

  it('resolves members through unrouted `member.get` overrides', async () => {
    const active = await Note.query().insert({ name: 'Active' })
    const archived = await Note.query().insert({ name: 'Archived' })
    const url = `${getAppUrl(app)}/unarchived-notes`
    // `allow` doesn't route `member.get`, but members still resolve through it.
    const getResponse = await fetch(`${url}/${active.id}`)
    expect(getResponse.status).toBe(404)
    const archivedResponse = await fetch(`${url}/${archived.id}/name`)
    expect(archivedResponse.status).toBe(404)
    const activeResponse = await fetch(`${url}/${active.id}/name`)
    expect(activeResponse.status).toBe(200)
    expect(await activeResponse.json()).toEqual({ name: 'Active' })
  })

  it('routes inherited `member.get` overrides in object notation', async () => {
    const active = await Note.query().insert({ name: 'Active' })
    const archived = await Note.query().insert({ name: 'Archived' })
    const url = `${getAppUrl(app)}/unarchived-named-notes`
    const archivedResponse = await fetch(`${url}/${archived.id}`)
    expect(archivedResponse.status).toBe(404)
    const activeResponse = await fetch(`${url}/${active.id}`)
    expect(activeResponse.status).toBe(200)
    expect(await activeResponse.json()).toMatchObject({ name: 'Active' })
    const archivedNameResponse = await fetch(`${url}/${archived.id}/name`)
    expect(archivedNameResponse.status).toBe(404)
  })

  it('passes member options on through `member.get` overrides', async () => {
    const open = await Note.query().insert({ name: 'Open', done: false })
    const done = await Note.query().insert({ name: 'Done', done: true })
    const url = `${getAppUrl(app)}/active-notes`
    const openResponse = await fetch(`${url}/${open.id}/done-name`)
    expect(openResponse.status).toBe(404)
    const doneResponse = await fetch(`${url}/${done.id}/done-name`)
    expect(doneResponse.status).toBe(200)
    // `forUpdate` locks the member, which requires a transaction.
    const lockedResponse = await fetch(`${url}/${done.id}/locked-name`)
    expect(lockedResponse.status).toBe(200)
    expect(await lockedResponse.json()).toEqual({ name: 'Done' })
    const unlockedResponse = await fetch(`${url}/${done.id}/unlocked-name`)
    expect(unlockedResponse.status).toBe(400)
    expect(await unlockedResponse.json()).toMatchObject({
      message: expect.stringContaining('without a transaction is invalid')
    })
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

  it('calls `member.get` with the same `this` in all lookups', async () => {
    const active = await Note.query().insert({ name: 'Active' })
    const archived = await Note.query().insert({ name: 'Archived' })
    const url = `${getAppUrl(app)}/configured-notes`
    // Routed through `member.get` itself:
    const getResponse = await fetch(`${url}/${active.id}`)
    expect(getResponse.status).toBe(200)
    expect(await getResponse.json()).toMatchObject({ name: 'Active' })
    expect((await fetch(`${url}/${archived.id}`)).status).toBe(404)
    // Resolved by `getMember()` for a `from: 'member'` parameter:
    const nameResponse = await fetch(`${url}/${active.id}/name`)
    expect(nameResponse.status).toBe(200)
    expect(await nameResponse.json()).toEqual({ name: 'Active' })
    expect((await fetch(`${url}/${archived.id}/name`)).status).toBe(404)
    // Resolved by `getMember()` for an `$owner` check:
    const controller = app.getController('/configured-notes') as any
    const authorization = controller.processAuthorize('$owner')
    await expect(authorization(createOwnerContext(active.id))).resolves.toBe(
      true
    )
    await expect(
      authorization(createOwnerContext(archived.id))
    ).rejects.toMatchObject({ status: 404 })
  })
})
