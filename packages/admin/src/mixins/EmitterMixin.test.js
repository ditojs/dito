import { vi } from 'vitest'
import { mount } from '@vue/test-utils'
import EmitterMixin from './EmitterMixin.js'

const createEmitter = () =>
  mount({ mixins: [EmitterMixin], render: () => null }).vm

describe('EmitterMixin', () => {
  describe('on()', () => {
    it('registers a callback for each event of an array', async () => {
      const emitter = createEmitter()
      const callback = vi.fn()
      expect(emitter.on(['load', 'change'], callback)).toBe(emitter)
      await emitter.emit('load', 1)
      await emitter.emit('change', 2)
      expect(callback.mock.calls).toEqual([[1], [2]])
    })

    it('registers the callbacks of an object by event', async () => {
      const emitter = createEmitter()
      const load = vi.fn()
      const change = vi.fn()
      emitter.on({ load, change })
      await emitter.emit('change')
      expect(load).not.toHaveBeenCalled()
      expect(change).toHaveBeenCalledOnce()
    })

    it('calls the callbacks with the component as `this`', async () => {
      const emitter = createEmitter()
      let receiver = null
      emitter.on('load', function () {
        receiver = this
      })
      await emitter.emit('load')
      expect(receiver).toBe(emitter)
    })
  })

  describe('once()', () => {
    it('calls the callback only for the first event', async () => {
      const emitter = createEmitter()
      const callback = vi.fn(value => value * 2)
      emitter.once('load', callback)
      expect(await emitter.emit('load', 2)).toBe(4)
      expect(await emitter.emit('load', 3)).toBe(undefined)
      expect(callback).toHaveBeenCalledOnce()
    })

    it('calls the callbacks registered after it', async () => {
      const emitter = createEmitter()
      const callback = vi.fn()
      emitter.once('load', () => {})
      emitter.on('load', callback)
      await emitter.emit('load')
      expect(callback).toHaveBeenCalledOnce()
    })

    it('calls the callback only once for concurrent emits', async () => {
      const emitter = createEmitter()
      const callback = vi.fn()
      emitter.on('load', () => new Promise(resolve => setTimeout(resolve)))
      emitter.once('load', callback)
      await Promise.all([emitter.emit('load'), emitter.emit('load')])
      expect(callback).toHaveBeenCalledOnce()
    })

    it('can be removed through the original callback', async () => {
      const emitter = createEmitter()
      const callback = vi.fn()
      emitter.once('load', callback)
      emitter.off('load', callback)
      await emitter.emit('load')
      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('off()', () => {
    it('removes all events without arguments', () => {
      const emitter = createEmitter()
      emitter.on({ load: () => {}, change: () => {} })
      expect(emitter.off()).toBe(emitter)
      expect(emitter.hasListeners('load')).toBe(false)
      expect(emitter.hasListeners('change')).toBe(false)
    })

    it('removes all callbacks of an event without a callback', () => {
      const emitter = createEmitter()
      emitter.on('load', () => {})
      emitter.on('load', () => {})
      emitter.on('change', () => {})
      emitter.off('load')
      expect(emitter.hasListeners('load')).toBe(false)
      expect(emitter.hasListeners('change')).toBe(true)
    })

    it('removes a specific callback of an event', async () => {
      const emitter = createEmitter()
      const first = vi.fn()
      const second = vi.fn()
      emitter.on('load', first)
      emitter.on('load', second)
      emitter.off('load', first)
      await emitter.emit('load')
      expect(first).not.toHaveBeenCalled()
      expect(second).toHaveBeenCalledOnce()
    })

    it('removes the callback for each event of an array', async () => {
      const emitter = createEmitter()
      const callback = vi.fn()
      emitter.on(['load', 'change'], callback)
      emitter.off(['load', 'change'], callback)
      await emitter.emit('load')
      await emitter.emit('change')
      expect(callback).not.toHaveBeenCalled()
    })

    it('removes the callbacks of an object by event', async () => {
      const emitter = createEmitter()
      const load = vi.fn()
      const change = vi.fn()
      emitter.on({ load, change })
      emitter.off({ load, change })
      await emitter.emit('load')
      await emitter.emit('change')
      expect(load).not.toHaveBeenCalled()
      expect(change).not.toHaveBeenCalled()
    })

    it('ignores unknown events and callbacks', async () => {
      const emitter = createEmitter()
      const callback = vi.fn()
      expect(emitter.off('load', callback)).toBe(emitter)
      emitter.on('load', callback)
      emitter.off('load', () => {})
      await emitter.emit('load')
      expect(callback).toHaveBeenCalledOnce()
    })
  })

  describe('emit()', () => {
    it('resolves without listeners', async () => {
      const emitter = createEmitter()
      await expect(emitter.emit('load')).resolves.toBe(undefined)
    })

    it('resolves with the last result that is not undefined', async () => {
      const emitter = createEmitter()
      emitter.on('load', () => 'first')
      emitter.on('load', async () => 'second')
      emitter.on('load', () => undefined)
      expect(await emitter.emit('load')).toBe('second')
    })

    it('runs the callbacks of one emit one after the other', async () => {
      const emitter = createEmitter()
      const calls = []
      emitter.on('load', async () => {
        calls.push('start first')
        await Promise.resolve()
        calls.push('end first')
      })
      emitter.on('load', () => calls.push('second'))
      await emitter.emit('load')
      expect(calls).toEqual(['start first', 'end first', 'second'])
    })

    it('runs separate emits of the same event concurrently', async () => {
      const emitter = createEmitter()
      const calls = []
      const resolvers = {}
      emitter.on('load', async value => {
        calls.push(`start ${value}`)
        await new Promise(resolve => (resolvers[value] = resolve))
        calls.push(`end ${value}`)
        return value
      })
      const first = emitter.emit('load', 1)
      const second = emitter.emit('load', 2)
      // The second emit doesn't wait for the first one to be handled.
      await vi.waitFor(() => expect(calls).toEqual(['start 1', 'start 2']))
      resolvers[2]()
      expect(await second).toBe(2)
      resolvers[1]()
      expect(await first).toBe(1)
      expect(calls).toEqual(['start 1', 'start 2', 'end 2', 'end 1'])
    })

    it('handles an emit awaited by a callback of the same event', async () => {
      const emitter = createEmitter()
      emitter.on('load', async value =>
        value > 0 ? (await emitter.emit('load', value - 1)) + 1 : 0
      )
      // Race against a timer, so that a deadlock fails instead of hanging.
      const timeout = new Promise(resolve =>
        setTimeout(() => resolve('timeout'), 100)
      )
      expect(await Promise.race([emitter.emit('load', 2), timeout])).toBe(2)
    })

    it('calls all callbacks and rejects with their errors', async () => {
      const emitter = createEmitter()
      const after = vi.fn()
      emitter.on('load', () => {
        throw new Error('First')
      })
      emitter.on('load', async () => {
        throw new Error('Second')
      })
      emitter.on('load', after)
      const promise = emitter.emit('load')
      await expect(promise).rejects.toThrow(
        `Errors during event handler for 'load'`
      )
      const error = await promise.catch(error => error)
      expect(error).toBeInstanceOf(AggregateError)
      expect(error.errors.map(error => error.message)).toEqual([
        'First',
        'Second'
      ])
      expect(after).toHaveBeenCalledOnce()
    })

    it('handles separate emits independently of a failed one', async () => {
      const emitter = createEmitter()
      emitter.on('load', value => {
        if (value === 1) throw new Error('Failed')
        return value
      })
      const first = emitter.emit('load', 1)
      const second = emitter.emit('load', 2)
      await expect(first).rejects.toThrow(AggregateError)
      expect(await second).toBe(2)
    })
  })

  describe('hasListeners()', () => {
    it('checks whether all events of an array have listeners', () => {
      const emitter = createEmitter()
      emitter.on('load', () => {})
      expect(emitter.hasListeners(['load'])).toBe(true)
      expect(emitter.hasListeners(['load', 'change'])).toBe(false)
      expect(emitter.hasListeners([])).toBe(false)
    })
  })

  describe('delegate()', () => {
    it('re-emits the events on the target', async () => {
      const emitter = createEmitter()
      const target = createEmitter()
      const callback = vi.fn(value => value + 1)
      target.on(['load', 'change'], callback)
      expect(emitter.delegate(['load', 'change'], target)).toBe(emitter)
      expect(await emitter.emit('load', 1)).toBe(2)
      expect(await emitter.emit('change', 2)).toBe(3)
      expect(callback).toHaveBeenCalledTimes(2)
    })

    it('ignores a missing target', () => {
      const emitter = createEmitter()
      expect(emitter.delegate('load', null)).toBe(emitter)
      expect(emitter.hasListeners('load')).toBe(false)
    })
  })
})
