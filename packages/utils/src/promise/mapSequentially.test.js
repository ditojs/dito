import { vi } from 'vitest'
import { mapSequentially } from './mapSequentially.js'

describe('mapSequentially()', () => {
  it('should map items in order, awaiting each callback', async () => {
    const order = []
    const results = await mapSequentially([30, 0, 10], async (delay, index) => {
      order.push(`start ${index}`)
      await new Promise(resolve => setTimeout(resolve, delay))
      order.push(`end ${index}`)
      return delay * 2
    })
    expect(results).toEqual([60, 0, 20])
    expect(order).toEqual([
      'start 0',
      'end 0',
      'start 1',
      'end 1',
      'start 2',
      'end 2'
    ])
  })

  it('should resolve a promise passed as input', async () => {
    const results = await mapSequentially(
      Promise.resolve(['a', 'b']),
      (item, index) => `${index}:${item}`
    )
    expect(results).toEqual(['0:a', '1:b'])
  })

  it('should support any iterable as input', async () => {
    const results = await mapSequentially(
      new Set(['first', 'second']),
      item => item.length
    )
    expect(results).toEqual([5, 6])
  })

  it('should resolve to an empty array for empty input', async () => {
    const callback = vi.fn()
    expect(await mapSequentially([], callback)).toEqual([])
    expect(callback).not.toHaveBeenCalled()
  })

  it('should stop at the first rejected callback', async () => {
    const error = new Error('Failed to process item')
    const callback = vi.fn(async item => {
      if (item === 'b') throw error
      return item
    })
    await expect(mapSequentially(['a', 'b', 'c'], callback)).rejects.toBe(
      error
    )
    expect(callback).toHaveBeenCalledTimes(2)
  })
})
