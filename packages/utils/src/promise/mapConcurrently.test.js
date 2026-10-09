import { vi } from 'vitest'
import { mapConcurrently } from './mapConcurrently.js'

function createDeferred() {
  let resolve
  const promise = new Promise(res => {
    resolve = res
  })
  return { promise, resolve }
}

function trackConcurrency() {
  const tracker = { active: 0, maximum: 0 }
  tracker.run = async (value, delay = 0) => {
    tracker.active++
    tracker.maximum = Math.max(tracker.maximum, tracker.active)
    await new Promise(resolve => setTimeout(resolve, delay))
    tracker.active--
    return value
  }
  return tracker
}

describe('mapConcurrently()', () => {
  it('should map all items in parallel without a concurrency limit', async () => {
    const tracker = trackConcurrency()
    const results = await mapConcurrently(
      ['a', 'b', 'c', 'd'],
      item => tracker.run(item.toUpperCase())
    )
    expect(results).toEqual(['A', 'B', 'C', 'D'])
    expect(tracker.maximum).toBe(4)
  })

  it('should resolve a promise or thenable passed as input', async () => {
    // Mirrors passing a lazy query builder that resolves to rows.
    const rows = [{ id: 1 }, { id: 2 }]
    const thenable = { then: resolve => resolve(rows) }
    expect(await mapConcurrently(thenable, row => row.id)).toEqual([1, 2])
    expect(
      await mapConcurrently(Promise.resolve(rows), async row => row.id * 10)
    ).toEqual([10, 20])
  })

  it('should never exceed the given concurrency', async () => {
    const tracker = trackConcurrency()
    const items = [1, 2, 3, 4, 5, 6, 7]
    const results = await mapConcurrently(
      items,
      (item, index) => tracker.run(item * 2, (items.length - index) % 3),
      { concurrency: 2 }
    )
    expect(results).toEqual([2, 4, 6, 8, 10, 12, 14])
    expect(tracker.maximum).toBe(2)
  })

  it('should keep results in input order when items finish out of order', async () => {
    const deferreds = [createDeferred(), createDeferred(), createDeferred()]
    const promise = mapConcurrently(
      deferreds,
      deferred => deferred.promise,
      { concurrency: 3 }
    )
    deferreds[2].resolve('third')
    deferreds[0].resolve('first')
    deferreds[1].resolve('second')
    expect(await promise).toEqual(['first', 'second', 'third'])
  })

  it('should pass item, index and array to the callback', async () => {
    const calls = []
    const items = ['x', 'y']
    await mapConcurrently(
      items,
      (item, index, array) => calls.push([item, index, array]),
      { concurrency: 1 }
    )
    expect(calls).toEqual([
      ['x', 0, items],
      ['y', 1, items]
    ])
  })

  it('should process items one by one with a concurrency of 1', async () => {
    const order = []
    await mapConcurrently(
      [30, 10, 20],
      async delay => {
        order.push(`start ${delay}`)
        await new Promise(resolve => setTimeout(resolve, delay))
        order.push(`end ${delay}`)
      },
      { concurrency: 1 }
    )
    expect(order).toEqual([
      'start 30',
      'end 30',
      'start 10',
      'end 10',
      'start 20',
      'end 20'
    ])
  })

  it('should accept synchronous callbacks with a concurrency limit', async () => {
    expect(
      await mapConcurrently([1, 2, 3], value => value + 1, { concurrency: 2 })
    ).toEqual([2, 3, 4])
  })

  it('should not start more workers than there are items', async () => {
    const callback = vi.fn(value => value)
    expect(
      await mapConcurrently([1, 2], callback, { concurrency: 10 })
    ).toEqual([1, 2])
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('should resolve to an empty array for empty input', async () => {
    const callback = vi.fn()
    expect(await mapConcurrently([], callback)).toEqual([])
    expect(await mapConcurrently([], callback, { concurrency: 3 })).toEqual([])
    expect(callback).not.toHaveBeenCalled()
  })

  it('should reject with the first error and stop scheduling new items', async () => {
    const error = new Error('Failed to process item')
    const callback = vi.fn(async value => {
      if (value === 2) throw error
      return value
    })
    await expect(
      mapConcurrently([1, 2, 3, 4], callback, { concurrency: 1 })
    ).rejects.toBe(error)
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('should reject with the callback error without a concurrency limit', async () => {
    const error = new Error('Failed')
    await expect(
      mapConcurrently([1], () => Promise.reject(error))
    ).rejects.toBe(error)
  })
})
