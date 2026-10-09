import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { stripVTControlCharacters } from 'util'
import type { ModelProperties } from '@ditojs/server'
import { Controller, Model, ModelController } from '@ditojs/server'
import { createTestApp, getAppUrl } from '../utils/app.js'
import { createTestDatabase } from '../utils/database.js'

class Ingredient extends Model {
  declare id: number
  declare name: string
  declare photo: any

  static override properties: ModelProperties = {
    name: {
      type: 'string',
      required: true
    },
    photo: {
      type: 'object',
      nullable: true
    }
  }

  static override assets: any = {
    photo: {
      storage: 'photos'
    }
  }
}

const events: string[] = []

class PantryController extends Controller {
  hooks: any = {
    'before:actions:*'(ctx: any) {
      events.push(`base before ${ctx.action.name}`)
    },
    'after:actions:get stock'(ctx: any, result: any) {
      events.push('base after')
      return { ...result, checkedBy: 'base' }
    }
  }

  override actions: any = {
    'get stock'() {
      return { count: 3 }
    },

    'get hidden'() {
      return 'hidden'
    }
  }
}

class Pantry extends PantryController {
  override hooks: any = {
    'after:actions:get stock'(ctx: any, result: any) {
      events.push('sub after')
      return { ...result, checkedBy: `${result.checkedBy} and sub` }
    }
  }

  override actions: any = {
    // Inherited actions need to be listed in `allow` again.
    'allow': ['get stock'],

    'get .': {
      // Responds to `GET /pantry` through the special '.' path.
      handler() {
        return 'index'
      }
    }
  }
}

class Shelf extends Controller {
  override actions: any = {
    'allow': ['*'],

    'get .'() {
      return 'shelf'
    }
  }
}

class Cellar extends Pantry {
  override path = 'basement'
}

class KitchenToolsController extends Controller {
  initializedWith: string | null = null

  override async initialize() {
    this.initializedWith = this.app.config.app?.normalizePaths
      ? 'normalized'
      : 'plain'
  }

  override compose() {
    return async (ctx: any, next: any) => {
      if (ctx.path === '/drawer') {
        ctx.body = { composed: true, url: this.url }
      } else {
        await next()
      }
    }
  }

  override actions: any = {
    'get list'(this: any) {
      return {
        name: this.name,
        initializedWith: this.controller.initializedWith
      }
    }
  }
}

class Cooking extends Controller {
  override transacted = true

  override actions: any = {
    async 'post boil'(ctx: any) {
      const trx = ctx.transaction
      trx.on('commit', () => events.push('commit'))
      return { transacted: !!trx }
    },

    async 'post burn'(ctx: any) {
      ctx.transaction.on('rollback', (error: Error) =>
        events.push(`rollback ${error.message}`)
      )
      throw new Error('Burnt')
    },

    'get taste': {
      transacted: false,
      handler(ctx: any) {
        return { transacted: !!ctx.transaction }
      }
    }
  }
}

class Ingredients extends ModelController<any> {
  override modelClass = Ingredient
  // Merged with the model's assets, to control access to the uploads.
  override assets: any = {
    'authorize': {
      photo: 'nobody'
    },
    'gallery.*': {
      storage: 'photos'
    },
    'scrapbook.**': {
      storage: 'photos'
    }
  }

  override collection: any = {
    allow: ['get']
  }
}

class OpenIngredients extends ModelController<any> {
  override modelClass = Ingredient
  override assets: any = true
}

describe('Controller setup', () => {
  let storagePath: string
  let app: ReturnType<typeof createTestApp>
  let url: string

  beforeAll(async () => {
    storagePath = await fs.mkdtemp(path.join(os.tmpdir(), 'dito-uploads-'))
    app = createTestApp({
      config: {
        storages: {
          photos: {
            type: 'disk',
            path: storagePath,
            url: 'https://cdn.example.com/uploads/'
          }
        }
      },
      models: { Ingredient },
      controllers: {
        Pantry,
        Shelf,
        Cooking,
        api: {
          kitchen: { KitchenToolsController, Cellar }
        },
        Ingredients,
        OpenIngredients
      }
    })
    await createTestDatabase(app)
    await app.start()
    url = getAppUrl(app)
  })

  afterAll(async () => {
    await app.stop()
    await app.knex.destroy()
    await fs.rm(storagePath, { recursive: true, force: true })
  })

  afterEach(() => {
    events.length = 0
  })

  const getJson = async (path: string, init?: RequestInit) => {
    const response = await fetch(`${url}${path}`, init)
    return { status: response.status, data: await response.json() }
  }

  describe('routing', () => {
    it('derives the route from the controller name', async () => {
      expect(app.getController('/pantry')).toBeInstanceOf(Pantry)
      expect((await getJson('/pantry/stock')).status).toBe(200)
    })

    it('maps the special `.` path to the controller url', async () => {
      expect(await (await fetch(`${url}/pantry`)).text()).toBe('index')
      expect(await (await fetch(`${url}/shelf`)).text()).toBe('shelf')
    })

    it('only routes inherited actions that are allowed', async () => {
      expect((await fetch(`${url}/pantry/hidden`)).status).toBe(404)
    })

    it('maps nested controller objects to namespaces', async () => {
      const response = await getJson('/api/kitchen/kitchen-tools/list')
      expect(response.data).toEqual({
        name: 'KitchenTools',
        initializedWith: 'normalized'
      })
      expect(app.getController('/api/kitchen/kitchen-tools')).toBeInstanceOf(
        KitchenToolsController
      )
    })

    it('supports overriding the path of the controller', async () => {
      const controller = app.getController('/api/kitchen/basement')
      expect(controller).toBeInstanceOf(Cellar)
      expect(controller?.name).toBe('Cellar')
      expect((await getJson('/api/kitchen/basement/stock')).status).toBe(200)
    })

    it('mounts the middleware returned by `compose()`', async () => {
      const response = await getJson('/api/kitchen/kitchen-tools/drawer')
      expect(response.data).toEqual({
        composed: true,
        url: '/api/kitchen/kitchen-tools'
      })
    })

    it('exposes the controllers to `findController()`', () => {
      expect(app.findController(controller => controller.name === 'Shelf'))
        .toBeInstanceOf(Shelf)
      expect(app.findController(() => false)).toBeNull()
      expect(app.getController('/unknown')).toBeNull()
    })
  })

  describe('hooks', () => {
    it('runs inherited hooks in sequence, base classes first', async () => {
      const response = await getJson('/pantry/stock')
      expect(response.data).toEqual({ count: 3, checkedBy: 'base and sub' })
      expect(events).toEqual([
        'base before get stock', 'base after', 'sub after'
      ])
    })

    it('matches wildcard hooks against all actions', async () => {
      await fetch(`${url}/pantry`)
      expect(events).toEqual(['base before get .'])
    })
  })

  describe('transactions', () => {
    it('runs actions of transacted controllers in transactions', async () => {
      const response = await getJson('/cooking/boil', { method: 'POST' })
      expect(response.data).toEqual({ transacted: true })
      expect(events).toEqual(['commit'])
    })

    it('rolls back transactions and emits `rollback` on errors', async () => {
      const response = await getJson('/cooking/burn', { method: 'POST' })
      expect(response.status).toBe(500)
      expect(events).toEqual(['rollback Burnt'])
    })

    it('lets actions opt out of transactions', async () => {
      expect((await getJson('/cooking/taste')).data).toEqual({
        transacted: false
      })
    })
  })

  describe('asset uploads', () => {
    const upload = (path: string, field: string) => {
      const form = new FormData()
      form.append(
        field,
        new Blob(['carrot'], { type: 'text/plain' }),
        'carrot.txt'
      )
      return fetch(`${url}${path}`, { method: 'POST', body: form })
    }

    it('stores uploaded files and responds with their file objects', async () => {
      const response = await upload('/open-ingredients/upload/photo', 'photo')
      expect(response.status).toBe(200)
      const [file] = await response.json()
      expect(file).toMatchObject({
        name: 'carrot.txt',
        type: 'text/plain',
        size: 6
      })
      expect(file.url).toMatch(/^https:\/\/cdn.example.com\/uploads\//)
      const stored = path.join(storagePath, file.key[0], file.key[1], file.key)
      expect(await fs.readFile(stored, 'utf8')).toBe('carrot')
    })

    it('ignores uploaded files whose field does not match the data path', async () => {
      const response = await upload('/open-ingredients/upload/photo', 'other')
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual([])
    })

    it('matches wildcards in asset data paths', async () => {
      const response = await upload(
        '/ingredients/upload/gallery/*',
        'gallery/2'
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toHaveLength(1)
    })

    it('matches deep wildcards in asset data paths', async () => {
      const response = await upload(
        '/ingredients/upload/scrapbook/**',
        'scrapbook/2/pages/5'
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toHaveLength(1)
    })

    it('authorizes uploads before receiving the files', async () => {
      const response = await upload('/ingredients/upload/photo', 'photo')
      expect(response.status).toBe(401)
    })
  })
})

describe('Controller setup errors', () => {
  it('rejects assets with unknown storages', async () => {
    class Pots extends ModelController<any> {
      override modelClass = Ingredient
      override assets: any = {
        photo: { storage: 'nowhere' }
      }
    }
    const app = createTestApp({
      models: { Ingredient },
      controllers: { Pots }
    })
    await expect(app.setupControllers()).rejects.toThrow(
      `Controller Pots: Unknown storage configuration: 'nowhere'`
    )
    await app.knex.destroy()
  })

  it('rejects invalid controllers', () => {
    const app = createTestApp()
    expect(() => app.addController({} as any)).toThrow('Invalid controller')
    return app.knex.destroy()
  })

  it('rejects relations that are not defined on the model', async () => {
    class Jars extends ModelController<any> {
      override modelClass = Ingredient
      override relations: any = {
        lids: {}
      }
    }
    const app = createTestApp({
      models: { Ingredient },
      controllers: { Jars }
    })
    await expect(app.setupControllers()).rejects.toThrow(
      `Controller Jars: Relation 'lids' not found.`
    )
    await app.knex.destroy()
  })

  it('rejects relations that are not objects', async () => {
    class Jars extends ModelController<any> {
      override modelClass = Ingredient
      override relations: any = {
        lids: true
      }
    }
    const app = createTestApp({
      models: { Ingredient },
      controllers: { Jars }
    })
    await expect(app.setupControllers()).rejects.toThrow(
      `Controller Jars: Invalid relation 'lids'.`
    )
    await app.knex.destroy()
  })
})

// Actions stored in a constant are shared by all instances, also with the
// instances of sub-classes that don't define their own actions.
const readingRoomActions: any = {
  'get hours'() {
    return { opens: 9 }
  }
}

class ReadingRoomController extends Controller {
  override actions: any = readingRoomActions
}

class ReadingRoom extends ReadingRoomController {}

class Lobby extends Controller {
  override path = ''

  override actions: any = {
    'get welcome'() {
      return 'welcome'
    },

    'get member': {
      parameters: { member: { from: 'member' } },
      handler(_ctx: any, { member }: any) {
        // Plain controllers have no members to resolve.
        return { member }
      }
    },

    // Validates the whole query object, borrowed from the query.
    'post search': Object.assign((_ctx: any, query: any) => query, {
      parameters: [
        {
          from: 'query',
          type: 'object',
          properties: { pages: { type: 'integer' } }
        }
      ]
    })
  }
}

describe('Controller setup details', () => {
  let app: ReturnType<typeof createTestApp>
  let url: string
  // Collect the logs separately, as the spy's calls are cleared before tests,
  // without the colors that they have in CI.
  const logged: string[] = []
  let info: ReturnType<typeof vi.spyOn>

  beforeAll(async () => {
    info = vi
      .spyOn(console, 'info')
      .mockImplementation((...args) =>
        logged.push(stripVTControlCharacters(args.join(' ')))
      )
    app = createTestApp()
    // Set after creation, as `createTestApp()` silences all logging.
    app.config.log = { routes: true }
    app.addControllers({ ReadingRoom, library: { Lobby } })
    await app.start()
    url = getAppUrl(app)
  })

  afterAll(async () => {
    await app.stop()
    await app.knex.destroy()
    info.mockRestore()
  })

  it('logs the routes of the controllers with `log.routes`', () => {
    expect(logged).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^\/library\/:$/),
        expect.stringMatching(/GET \/library\/welcome/)
      ])
    )
  })

  it('routes controllers with an empty path at their namespace', async () => {
    expect(app.getController('/library')).toBeInstanceOf(Lobby)
    expect(await (await fetch(`${url}/library/welcome`)).text()).toBe(
      'welcome'
    )
  })

  it('inherits shared actions without own actions', async () => {
    const response = await fetch(`${url}/reading-room/hours`)
    expect(await response.json()).toEqual({ opens: 9 })
  })

  it('resolves member parameters of plain controllers to null', async () => {
    const response = await fetch(`${url}/library/member`)
    expect(await response.json()).toEqual({ member: null })
  })

  it('validates unnamed parameters borrowed from other sources', async () => {
    const response = await fetch(`${url}/library/search?pages=12`, {
      method: 'POST'
    })
    expect(await response.json()).toEqual({ pages: 12 })
  })
})
