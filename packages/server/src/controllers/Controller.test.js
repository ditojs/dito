import { Application } from '../app/Application.js'
import { Controller } from './Controller.js'

describe('Controller', () => {
  describe('hooks', () => {
    const calls = []
    const createHooks = () => ({
      'after:*:*'() {
        calls.push('wildcard')
      }
    })

    class Base extends Controller {
      hooks = createHooks()
    }

    class Middle extends Base {}

    class Leaf extends Middle {
      hooks = {
        'after:controller:get'() {
          calls.push('own')
        }
      }
    }

    function createController(ControllerClass) {
      const app = new Application({
        config: { log: { silent: true } }
      })
      const controller = new ControllerClass(app)
      controller.configure()
      return controller
    }

    beforeEach(() => {
      calls.length = 0
    })

    it('runs inherited wildcard hooks once', async () => {
      await createController(Middle).emitHook('after:controller:get')
      expect(calls).toEqual(['wildcard'])
    })

    it('runs inherited wildcard hooks once over several levels', async () => {
      class Deep extends Middle {}
      await createController(Deep).emitHook('after:controller:get')
      expect(calls).toEqual(['wildcard'])
    })

    it('runs inherited wildcard hooks once next to own hooks', async () => {
      await createController(Leaf).emitHook('after:controller:get')
      expect(calls.sort()).toEqual(['own', 'wildcard'])
    })

    it('runs inherited and own hooks for the same event', async () => {
      class Override extends Middle {
        hooks = {
          'after:*:*'() {
            calls.push('own')
          }
        }
      }
      await createController(Override).emitHook('after:controller:get')
      expect(calls).toEqual(['wildcard', 'own'])
    })
  })
})
