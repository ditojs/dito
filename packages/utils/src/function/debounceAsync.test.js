import { debounceAsync } from './debounceAsync'

// Tell jest to mock all timeout functions:
jest.useFakeTimers()

describe('debounceAsync()', () => {
  const fixture = Symbol('fixture')

  it('should never execute if intervals are less than wait', () => {
    const func = jest.fn()
    const debounced = debounceAsync(func, 1000)
    for (let i = 0; i < 10; i++) {
      jest.advanceTimersByTime(500)
      debounced()
    }
    expect(func).toBeCalledTimes(0)
  })

  it('should execute just once if an interval is big enough', () => {
    const func = jest.fn()
    const debounced = debounceAsync(func, 1000)
    for (let i = 0; i < 10; i++) {
      jest.advanceTimersByTime(500)
      debounced()
    }
    jest.advanceTimersByTime(1000)
    debounced()
    expect(func).toBeCalledTimes(1)
  })

  it('should pass through argument', async () => {
    expect.assertions(2)
    const func = jest.fn(async value => value)
    const debounced = debounceAsync(func, 1000)
    const promise = debounced(fixture)
    jest.advanceTimersByTime(1000)
    expect(await promise).toBe(fixture)
    expect(func).toBeCalledTimes(1)
  })

  it('should pass through return value', async () => {
    expect.assertions(2)
    const func = jest.fn().mockResolvedValueOnce(fixture)
    const debounced = debounceAsync(func, 1000)
    const promises = []
    promises.push(debounced())
    jest.advanceTimersByTime(1000)
    promises.push(debounced())
    expect(await Promise.all(promises)).toStrictEqual([fixture, fixture])
    expect(func).toBeCalledTimes(1)
  })

  it('should pass through `this`', async () => {
    expect.assertions(2)
    const func = jest.fn(async function() { return this })
    const debounced = debounceAsync(func, 1000)
    const obj = {}
    const promises = []
    promises.push(debounced.call(obj))
    jest.advanceTimersByTime(1000)
    promises.push(debounced.call(obj))
    expect(await Promise.all(promises)).toStrictEqual([obj, obj])
    expect(func).toBeCalledTimes(1)
  })

  it('should allow to cancel', async () => {
    expect.assertions(6)
    const func = jest.fn()
    const debounced = debounceAsync(func, 1000)
    const promise = debounced()
    jest.advanceTimersByTime(500)
    expect(debounced.cancel()).toBe(true)
    expect(debounced.cancel()).toBe(false)
    jest.advanceTimersByTime(500)
    expect(func).toBeCalledTimes(0)
    expect(await promise).toBeUndefined()
    jest.advanceTimersByTime(1000)
    expect(func).toBeCalledTimes(0)
    await debounced()
    jest.advanceTimersByTime(1000)
    expect(func).toBeCalledTimes(1)
  })

  it(
    'should execute once immediately if intervals are less than wait',
    async () => {
      expect.assertions(2)
      const func = jest.fn()
      const debounced = debounceAsync(func, 1000, true)
      const promises = []
      promises.push(debounced())
      expect(func).toBeCalledTimes(1)
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(500)
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
      const func = jest.fn()
      const debounced = debounceAsync(func, 1000, true)
      const promises = []
      promises.push(debounced())
      expect(func).toBeCalledTimes(1)
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(500)
        promises.push(debounced())
      }
      expect(func).toBeCalledTimes(1)
      jest.advanceTimersByTime(1000)
      promises.push(debounced())
      await Promise.all(promises)
      expect(func).toBeCalledTimes(2)
    }
  )
})
