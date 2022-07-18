import { debounceAsync } from './debounceAsync.js'
import { vi } from 'vitest'

// Tell vitest to mock all timeout functions:
vi.useFakeTimers()

describe('debounceAsync()', () => {
  const fixture = Symbol('fixture')

  it('should never execute if intervals are less than wait', () => {
    const func = vi.fn()
    const debounced = debounceAsync(func, 1000)
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(500)
      debounced()
    }
    expect(func).toBeCalledTimes(0)
  })

  it('should execute just once if an interval is big enough', () => {
    const func = vi.fn()
    const debounced = debounceAsync(func, 1000)
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(500)
      debounced()
    }
    vi.advanceTimersByTime(1000)
    debounced()
    expect(func).toBeCalledTimes(1)
  })

  it('should pass through argument', async () => {
    expect.assertions(2)
    const func = vi.fn(async value => value)
    const debounced = debounceAsync(func, 1000)
    const promise = debounced(fixture)
    vi.advanceTimersByTime(1000)
    expect(await promise).toBe(fixture)
    expect(func).toBeCalledTimes(1)
  })

  it('should pass through return value', async () => {
    expect.assertions(2)
    const func = vi.fn().mockResolvedValueOnce(fixture)
    const debounced = debounceAsync(func, 1000)
    const promises = []
    promises.push(debounced())
    vi.advanceTimersByTime(1000)
    promises.push(debounced())
    expect(await Promise.all(promises)).toStrictEqual([fixture, fixture])
    expect(func).toBeCalledTimes(1)
  })

  it('should pass through `this`', async () => {
    expect.assertions(2)
    const func = vi.fn(async function() { return this })
    const debounced = debounceAsync(func, 1000)
    const obj = {}
    const promises = []
    promises.push(debounced.call(obj))
    vi.advanceTimersByTime(1000)
    promises.push(debounced.call(obj))
    expect(await Promise.all(promises)).toStrictEqual([obj, obj])
    expect(func).toBeCalledTimes(1)
  })

  it('should allow to cancel', async () => {
    expect.assertions(6)
    const func = vi.fn()
    const debounced = debounceAsync(func, 1000)
    const promise = debounced()
    vi.advanceTimersByTime(500)
    expect(debounced.cancel()).toBe(true)
    expect(debounced.cancel()).toBe(false)
    vi.advanceTimersByTime(500)
    expect(func).toBeCalledTimes(0)
    expect(await promise).toBeUndefined()
    vi.advanceTimersByTime(1000)
    expect(func).toBeCalledTimes(0)
    await debounced()
    vi.advanceTimersByTime(1000)
    expect(func).toBeCalledTimes(1)
  })

  it(
    'should execute once immediately if intervals are less than wait',
    async () => {
      expect.assertions(2)
      const func = vi.fn()
      const debounced = debounceAsync(func, { delay: 1000, immediate: true })
      const promises = []
      promises.push(debounced())
      expect(func).toBeCalledTimes(1)
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(500)
        promises.push(debounced())
      }
      await Promise.all(promises)
      expect(func).toBeCalledTimes(1)
    }
  )

  it(
    'should execute twice immediately with long enough intervals',
    async () => {
      expect.assertions(3)
      const func = vi.fn()
      const debounced = debounceAsync(func, { delay: 1000, immediate: true })
      const promises = []
      promises.push(debounced())
      expect(func).toBeCalledTimes(1)
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(500)
        promises.push(debounced())
      }
      expect(func).toBeCalledTimes(1)
      vi.advanceTimersByTime(1000)
      promises.push(debounced())
      await Promise.all(promises)
      expect(func).toBeCalledTimes(2)
    }
  )

  it(
    'should only reject the last waiting promise',
    async () => {
      expect.assertions(5)
      let count = 0
      const func = vi.fn(() => {
        if (++count > 1) {
          throw new Error('boom')
        }
      })
      const debounced = debounceAsync(func, { delay: 1000, immediate: true })
      const promises = []
      promises.push(debounced())
      expect(func).toBeCalledTimes(1)
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(500)
        promises.push(debounced())
      }
      expect(func).toBeCalledTimes(1)
      vi.advanceTimersByTime(1000)
      await expect(debounced()).rejects.toThrow('boom')
      const results = await Promise.all(promises)
      expect(results).toStrictEqual(new Array(11).fill(undefined))
      expect(func).toBeCalledTimes(2)
    }
  )
})
