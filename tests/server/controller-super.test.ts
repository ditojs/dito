import type { ModelProperties } from '@ditojs/server'
import { Controller, Model, ModelController } from '@ditojs/server'
import { createTestApp, getAppUrl } from '../utils/app.js'
import { createTestDatabase } from '../utils/database.js'

type Form = 'fn' | 'obj'

// Create the `get hello` action of each level, in function or object form,
// calling `super` from all levels but the base:
function createActions(name: string, form: Form, callsSuper = true) {
  return form === 'fn'
    ? {
        'get hello'(ctx: any) {
          return callsSuper ? `${name}(${super['get hello'](ctx)})` : name
        }
      }
    : {
        'get hello': {
          handler(ctx: any) {
            return callsSuper ? `${name}(${super['get hello'](ctx)})` : name
          }
        }
      }
}

// Create a chain of three controllers, where the middle one defines the action,
// has no own actions, or has empty actions:
function createChain(base: Form, middle: Form | 'none' | 'empty', leaf: Form) {
  class Base extends Controller {
    override actions: any = createActions('base', base, false)
  }

  const middleActions =
    middle === 'none'
      ? null
      : middle === 'empty'
        ? {}
        : createActions('middle', middle)
  const Middle = middleActions
    ? class extends Base {
        override actions: any = middleActions
      }
    : class extends Base {}

  return class Leaf extends Middle {
    override actions: any = createActions('leaf', leaf)
  }
}

const forms: Form[] = ['fn', 'obj']
const chains = forms.flatMap(base =>
  (['fn', 'obj', 'none', 'empty'] as const).flatMap(middle =>
    forms.map(leaf => ({
      base,
      middle,
      leaf,
      // Each chain is routed in its own namespace:
      namespace: `${base}-${middle}-${leaf}`,
      Leaf: createChain(base, middle, leaf)
    }))
  )
)

class Greeter extends Controller {
  override actions: any = {
    'get secret': {
      authorize: false,
      handler() {
        return 'secret'
      }
    },

    'get echo': {
      parameters: {
        name: { type: 'string', required: true }
      },
      handler(ctx: any, { name }: any) {
        return `echo ${name}`
      }
    }
  }
}

class Greeting extends Greeter {
  override actions: any = {
    'get hello'() {
      return 'hello'
    }
  }
}

class Shouting extends Greeter {
  override actions: any = {
    'get echo': {
      parameters: {
        name: { type: 'string', required: true }
      },
      handler(ctx: any, { name }: any) {
        return super['get echo'](ctx, { name: name.toUpperCase() })
      }
    }
  }
}

const exportAction = {
  handler() {
    return 'export'
  }
}

class Exports extends Controller {
  override actions: any = {
    'get export': exportAction
  }
}

class AdminExports extends Exports {
  override actions: any = {
    'get export': { ...exportAction, authorize: false }
  }
}

function report() {
  return 'report'
}

class Reports extends Controller {
  override actions: any = {
    'get open': { handler: report },
    'get closed': { handler: report, authorize: false }
  }
}

class Greetings extends Controller {
  override actions: any = {
    'get greet': Object.create({
      parameters: {
        name: { type: 'string', required: true }
      },
      handler(ctx: any, { name }: any) {
        return `hello ${name}`
      }
    })
  }
}

class LoudGreetings extends Greetings {
  override actions: any = {
    'get greet'(ctx: any) {
      return `${super['get greet'](ctx, { name: 'ada' })}!`
    }
  }
}

describe('Object-form actions', () => {
  let app: ReturnType<typeof createTestApp>

  beforeAll(async () => {
    app = createTestApp({
      controllers: {
        ...Object.fromEntries(
          chains.map(({ namespace, Leaf }) => [namespace, { Leaf }])
        ),
        Greeting,
        Shouting,
        Exports,
        AdminExports,
        Reports,
        Greetings,
        LoudGreetings
      }
    })
    await app.start()
  })

  afterAll(async () => {
    await app.stop()
    await app.knex.destroy()
  })

  async function request(path: string) {
    const response = await fetch(`${getAppUrl(app)}${path}`)
    return `${response.status} ${await response.text()}`
  }

  it.each(chains)(
    'reach the parent handler through super: $namespace',
    async ({ namespace, middle }) => {
      expect(await request(`/${namespace}/leaf/hello`)).toBe(
        middle === 'fn' || middle === 'obj'
          ? '200 leaf(middle(base))'
          : '200 leaf(base)'
      )
    }
  )

  it('keep their settings when inherited', async () => {
    expect(await request('/greeting/hello')).toBe('200 hello')
    expect(await request('/greeting/secret')).toMatch(/^401 /)
    expect(await request('/greeting/echo')).toMatch(/^400 /)
    expect(await request('/greeting/echo?name=ada')).toBe('200 echo ada')
  })

  it('receive parameters through super', async () => {
    expect(await request('/shouting/echo?name=ada')).toBe('200 echo ADA')
  })

  it('keep their settings when sharing a handler across levels', async () => {
    expect(await request('/exports/export')).toBe('200 export')
    expect(await request('/admin-exports/export')).toMatch(/^401 /)
  })

  it('keep their settings when sharing a handler across keys', async () => {
    expect(await request('/reports/open')).toBe('200 report')
    expect(await request('/reports/closed')).toMatch(/^401 /)
  })

  it('support inherited handlers and settings', async () => {
    expect(await request('/greetings/greet')).toMatch(/^400 /)
    expect(await request('/greetings/greet?name=ada')).toBe('200 hello ada')
    expect(await request('/loud-greetings/greet')).toBe('200 hello ada!')
  })
})

describe('Object-form actions in relations', () => {
  class Book extends Model {
    declare id: number
    declare shelfId: number

    static override properties: ModelProperties = {
      shelfId: { type: 'integer' }
    }
  }

  class Shelf extends Model {
    declare id: number

    static override relations: any = {
      books: {
        relation: 'hasMany',
        from: 'Shelf.id',
        to: 'Book.shelfId'
      }
    }
  }

  class BaseShelves extends ModelController<Shelf> {
    override modelClass = Shelf
    override relations: any = {
      books: {
        relation: {
          'get count': {
            handler() {
              return 'base'
            }
          }
        },
        member: {
          'get label': {
            handler() {
              return 'base'
            }
          }
        }
      }
    }
  }

  class Shelves extends BaseShelves {
    override relations: any = {
      books: {
        relation: {
          'get count': {
            handler(ctx: any) {
              return `shelves(${super['get count'](ctx)})`
            }
          }
        },
        member: {
          'get label': {
            handler(ctx: any) {
              return `shelves(${super['get label'](ctx)})`
            }
          }
        }
      }
    }
  }

  const app = createTestApp({
    models: { Book, Shelf },
    controllers: { Shelves }
  })

  beforeAll(async () => {
    await createTestDatabase(app)
    await app.start()
  })

  afterAll(async () => {
    await app.stop()
    await app.knex.destroy()
  })

  it('reach the parent handler through super', async () => {
    const shelf = await Shelf.query().insert({})
    const book = await Book.query().insert({ shelfId: shelf.id })
    const url = `${getAppUrl(app)}/shelves/${shelf.id}/books`
    for (const path of ['count', `${book.id}/label`]) {
      const response = await fetch(`${url}/${path}`)
      expect(`${response.status} ${await response.text()}`).toBe(
        '200 shelves(base)'
      )
    }
  })
})
