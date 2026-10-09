import { EventEmitter } from 'events'
import { emitAsync } from './emitter.js'

describe('emitAsync()', () => {
  it('calls all listeners with the arguments and awaits them', async () => {
    const emitter = new EventEmitter()
    const calls = []
    emitter.on('commit', async (...args) => {
      await new Promise(resolve => setTimeout(resolve, 5))
      calls.push(['first', ...args])
      return 1
    })
    emitter.on('commit', (...args) => {
      calls.push(['second', ...args])
      return 2
    })
    const results = await emitAsync(emitter, 'commit', 'a', 'b')
    expect(results).toEqual([1, 2])
    expect(calls).toContainEqual(['first', 'a', 'b'])
    expect(calls).toContainEqual(['second', 'a', 'b'])
  })

  it('calls listeners with the emitter as `this`', async () => {
    const emitter = new EventEmitter()
    let context = null
    emitter.on('rollback', function () {
      context = this
    })
    await emitAsync(emitter, 'rollback')
    expect(context).toBe(emitter)
  })

  it('resolves to an empty array without listeners', async () => {
    expect(await emitAsync(new EventEmitter(), 'commit')).toEqual([])
  })

  it('rejects when a listener rejects', async () => {
    const emitter = new EventEmitter()
    emitter.on('commit', async () => {
      throw new Error('Listener failed')
    })
    await expect(emitAsync(emitter, 'commit')).rejects.toThrow(
      'Listener failed'
    )
  })
})
