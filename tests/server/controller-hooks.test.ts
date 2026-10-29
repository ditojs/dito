import { Controller, Model, ModelController } from '@ditojs/server'
import { createTestApp, getAppUrl } from '../utils/app.js'

const events: string[] = []

class ShopController extends Controller {
  static override hooks: any = {
    'before:*:*'(ctx: any) {
      events.push(`before:*:* ${ctx.action.name}`)
    },
    'before:actions:*'(ctx: any) {
      events.push(`before:actions:* ${ctx.action.name}`)
    },
    'after:actions:get-isbn-price'(ctx: any, result: any) {
      events.push('base after')
      return { ...result, checkedBy: 'base' }
    }
  }

  override actions: any = {
    'get :isbn/price': {
      before(this: any, ctx: any) {
        events.push(`action before ${this === ctx.controller}`)
      },
      after(ctx: any, result: any) {
        events.push('action after')
        return { ...result, checkedBy: `${result.checkedBy} and action` }
      },
      handler() {
        return { price: 20 }
      }
    }
  }
}

class Shop extends ShopController {
  static override hooks: any = {
    'after:actions:get-isbn-price'(ctx: any, result: any) {
      events.push('sub after')
      return { ...result, checkedBy: `${result.checkedBy} and sub` }
    }
  }

  override actions: any = {
    'allow': ['get :isbn/price'],

    'get preview-:format'() {},
    'get :section'() {},
    'get :shopOrderId/status'() {},
    'get tech-doc-:format'() {},
    'get tech-doc-typst'() {},
    'get job-status/:token'() {},
    'post :id/publish'() {},

    'get :isbn/stock': {
      after() {
        return undefined
      },
      handler() {
        return { count: 3 }
      }
    }
  }
}

describe('Controller hooks', () => {
  let app: ReturnType<typeof createTestApp>
  let url: string

  beforeAll(async () => {
    app = createTestApp({ controllers: { Shop } })
    await app.start()
    url = getAppUrl(app)
  })

  afterAll(async () => {
    await app.stop()
    await app.knex.destroy()
  })

  afterEach(() => {
    events.length = 0
  })

  const getIdentifier = async (path: string, method = 'GET') => {
    let identifier = null
    app.getController('/shop')!.once('before:actions:*', (ctx: any) => {
      identifier = ctx.action.identifier
    })
    await fetch(`${url}/shop/${path}`, { method })
    return identifier
  }

  it('identifies actions by type, method and route, without colons', async () => {
    expect(await getIdentifier('fiction')).toBe('actions:get-section')
    expect(await getIdentifier('1/status')).toBe(
      'actions:get-shop-order-id-status'
    )
    expect(await getIdentifier('preview-pdf')).toBe(
      'actions:get-preview-format'
    )
    expect(await getIdentifier('tech-doc-pdf')).toBe(
      'actions:get-tech-doc-format'
    )
    expect(await getIdentifier('tech-doc-typst')).toBe(
      'actions:get-tech-doc-typst'
    )
    expect(await getIdentifier('job-status/abc')).toBe(
      'actions:get-job-status-token'
    )
    expect(await getIdentifier('1/publish', 'POST')).toBe(
      'actions:post-id-publish'
    )
  })

  it('matches wildcard hooks against actions with route parameters', async () => {
    await fetch(`${url}/shop/preview-pdf`)
    expect(events.sort()).toEqual([
      'before:*:* get preview-:format',
      'before:actions:* get preview-:format'
    ])
  })

  it(`runs the action's own hooks after the controller's`, async () => {
    const response = await fetch(`${url}/shop/1/price`)
    expect(await response.json()).toEqual({
      price: 20,
      checkedBy: 'base and sub and action'
    })
    expect(events).toEqual([
      'before:actions:* get :isbn/price',
      'before:*:* get :isbn/price',
      'action before true',
      'base after',
      'sub after',
      'action after'
    ])
  })

  it(`keeps the result when the action's after hook returns nothing`, async () => {
    const response = await fetch(`${url}/shop/1/stock`)
    expect(await response.json()).toEqual({ count: 3 })
  })
})

class Book extends Model {}

describe('Controller action identifiers', () => {
  const setupControllers = async (controllers: Record<string, any>) => {
    const app = createTestApp({ models: { Book }, controllers })
    try {
      await app.setupControllers()
    } finally {
      await app.knex.destroy()
    }
  }

  it('rejects actions with the same identifier', async () => {
    class Orders extends Controller {
      override actions: any = {
        'get :token'() {},
        'get token'() {}
      }
    }
    await expect(setupControllers({ Orders })).rejects.toThrow(
      `Controller Orders: Actions 'get :token' and 'get token' share the ` +
      `identifier 'actions:get-token' of their hooks: Change the route of ` +
      `'get token'.`
    )
  })

  it(`doesn't clash the default actions with parameterized ones`, async () => {
    class Books extends ModelController<any> {
      override modelClass = Book
      override collection: any = {
        'allow': ['get'],
        'get :section'() {}
      }
    }
    await expect(setupControllers({ Books })).resolves.toBeUndefined()
  })
})
