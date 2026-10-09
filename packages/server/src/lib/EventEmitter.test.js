import { vi } from 'vitest'
import { EventEmitter } from './EventEmitter.js'

class Library {
  constructor(events, options) {
    this._configureEmitter(events, options)
  }
}

EventEmitter.mixin(Library.prototype)

describe('EventEmitter', () => {
  it('can be used directly as a class', async () => {
    const emitter = new EventEmitter()
    const listener = vi.fn(() => 'done')
    emitter.on('open', listener)
    expect(await emitter.emit('open', 1, 2)).toEqual(['done'])
    expect(listener).toHaveBeenCalledWith(1, 2)
  })

  describe('mixin()', () => {
    it('adds the emitter methods to the target', () => {
      const library = new Library()
      for (const name of ['on', 'off', 'once', 'emit', 'emitAsync']) {
        expect(library[name]).toBeTypeOf('function')
      }
      expect(Object.hasOwn(Library.prototype, 'constructor')).toBe(true)
      expect(Library.prototype.constructor).toBe(Library)
    })
  })

  describe('_configureEmitter()', () => {
    it('registers the events passed as an object', async () => {
      const calls = []
      const library = new Library({
        'open': () => calls.push('open'),
        'close:before, close:after': event => calls.push(event),
        'lend': [() => calls.push('lend 1'), () => calls.push('lend 2')]
      })
      await library.emit('open')
      await library.emit('close:before', 'before')
      await library.emit('close:after', 'after')
      await library.emit('lend')
      expect(calls).toEqual(['open', 'before', 'after', 'lend 1', 'lend 2'])
    })

    it('allows unlimited listeners by default', () => {
      const library = new Library()
      expect(library.getMaxListeners()).toBe(0)
    })

    it('passes on options to the emitter', () => {
      const library = new Library({}, { maxListeners: 3 })
      expect(library.getMaxListeners()).toBe(3)
    })

    it('works without events', () => {
      const library = new Library()
      expect(library.listeners('open')).toEqual([])
    })
  })

  describe('emit()', () => {
    it('awaits async listeners and resolves to their results', async () => {
      const library = new Library()
      library.on('open', async () => {
        await new Promise(resolve => setTimeout(resolve, 5))
        return 'async'
      })
      library.on('open', () => 'sync')
      expect(await library.emit('open')).toEqual(['async', 'sync'])
    })

    it('rejects when a listener throws', async () => {
      const library = new Library()
      library.on('open', async () => {
        throw new Error('Closed for renovation')
      })
      await expect(library.emit('open')).rejects.toThrow(
        'Closed for renovation'
      )
    })

    it('resolves to an empty array without listeners', async () => {
      expect(await new Library().emit('open')).toEqual([])
    })
  })

  describe('on()', () => {
    it('registers a listener for each event in an array', async () => {
      const library = new Library()
      const listener = vi.fn()
      expect(library.on(['open', 'close'], listener)).toBe(library)
      await library.emit('open')
      await library.emit('close')
      expect(listener).toHaveBeenCalledTimes(2)
    })

    it('registers the listeners of an object', async () => {
      const library = new Library()
      const open = vi.fn()
      const close = vi.fn()
      library.on({ open, close })
      await library.emit('open')
      expect(open).toHaveBeenCalledTimes(1)
      expect(close).not.toHaveBeenCalled()
    })

    it('ignores unsupported event values', () => {
      const library = new Library()
      expect(library.on(42, vi.fn())).toBe(library)
      expect(library.eventNames()).toEqual([])
    })
  })

  describe('off()', () => {
    it('removes listeners by event name', async () => {
      const library = new Library()
      const listener = vi.fn()
      library.on('open', listener)
      expect(library.off('open', listener)).toBe(library)
      await library.emit('open')
      expect(listener).not.toHaveBeenCalled()
    })

    it('removes listeners for each event in an array', async () => {
      const library = new Library()
      const listener = vi.fn()
      library.on(['open', 'close'], listener)
      library.off(['open', 'close'], listener)
      await library.emit('open')
      await library.emit('close')
      expect(listener).not.toHaveBeenCalled()
    })

    it('removes the listeners of an object', async () => {
      const library = new Library()
      const open = vi.fn()
      library.on({ open })
      library.off({ open })
      await library.emit('open')
      expect(open).not.toHaveBeenCalled()
    })
  })

  describe('once()', () => {
    it('calls the listener only for the first event', async () => {
      const library = new Library()
      const listener = vi.fn()
      expect(library.once('open', listener)).toBe(library)
      await library.emit('open')
      await library.emit('open')
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('supports arrays of events', async () => {
      const library = new Library()
      const listener = vi.fn()
      library.once(['open', 'close'], listener)
      await library.emit('open')
      await library.emit('open')
      await library.emit('close')
      expect(listener).toHaveBeenCalledTimes(2)
    })
  })
})
