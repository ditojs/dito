import { vi } from 'vitest'
import { Application } from '../app/Application.js'
import { Controller } from './Controller.js'

const events = []

function createLogHooks(name) {
  return {
    'before:actions:get-orders'() {
      events.push(name)
    }
  }
}

class Base extends Controller {
  static hooks = createLogHooks('base')

  path = 'shop'

  actions = {
    'get orders'() {
      return events
    }
  }
}

async function getEvents(controllerClass) {
  const app = new Application({
    config: {
      app: { normalizePaths: true },
      log: { silent: true },
      logger: { prettyPrint: false, level: 'silent' },
      server: { host: '127.0.0.1', port: 0 }
    },
    controllers: { controllerClass }
  })
  await app.start()
  try {
    const { port } = app.server.address()
    const response = await fetch(`http://127.0.0.1:${port}/shop/orders`)
    return await response.json()
  } finally {
    await app.stop()
  }
}

describe('Controller', () => {
  afterEach(() => {
    events.length = 0
  })

  describe('static hooks', () => {
    it('runs the hooks of base classes once', async () => {
      class Middle extends Base {}
      class Leaf extends Middle {}
      expect(await getEvents(Middle)).toEqual(['base'])
      events.length = 0
      expect(await getEvents(Leaf)).toEqual(['base'])
    })

    it('runs the hooks of each declaring class once, base first', async () => {
      class Leaf extends Base {
        static hooks = createLogHooks('leaf')
      }
      class Sub extends Leaf {}
      expect(await getEvents(Leaf)).toEqual(['base', 'leaf'])
      events.length = 0
      expect(await getEvents(Sub)).toEqual(['base', 'leaf'])
    })
  })

  describe('hooks fields', () => {
    it('still runs them, with a deprecation warning', async () => {
      // `deprecate()` logs through `console.warn()`, silence and observe it:
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      class Leaf extends Base {
        hooks = createLogHooks('field')
      }
      try {
        expect(await getEvents(Leaf)).toEqual(['base', 'field'])
        expect(warn).toHaveBeenCalledWith(
          'Controller `hooks` fields are deprecated, use `static hooks` ' +
          'instead.'
        )
      } finally {
        warn.mockRestore()
      }
    })
  })
})
