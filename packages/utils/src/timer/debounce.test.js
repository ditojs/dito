import { debounce } from './debounce.js'
import { jest } from '@jest/globals'

// Tell jest to mock all timeout functions:
jest.useFakeTimers()

describe('debounce()', () => {
  const fixture = Symbol('fixture')

  it('should never execute if intervals are less than wait', () => {
    const func = jest.fn()
    const debounced = debounce(func, 1000)
    for (let i = 0; i < 10; i++) {
      jest.advanceTimersByTime(500)
      debounced()
    }
    expect(func).toBeCalledTimes(0)
  })

  it('should execute just once if an interval is big enough', () => {
    const func = jest.fn()
    const debounced = debounce(func, 1000)
    for (let i = 0; i < 10; i++) {
      jest.advanceTimersByTime(500)
      debounced()
    }
    jest.advanceTimersByTime(1000)
    debounced()
    expect(func).toBeCalledTimes(1)
  })

  it('should pass through argument', async () => {
    const func = jest.fn(value => value)
    const debounced = debounce(func, 1000)
    expect(debounced(fixture)).toBeUndefined()
    jest.advanceTimersByTime(1000)
    expect(debounced()).toBe(fixture)
    expect(func).toBeCalledTimes(1)
  })

  it('should pass through return value', () => {
    const func = jest.fn().mockReturnValue(fixture)
    const debounced = debounce(func, 1000)
    expect(debounced()).toBeUndefined()
    jest.advanceTimersByTime(1000)
    expect(debounced()).toBe(fixture)
    expect(func).toBeCalledTimes(1)
  })

  it('should pass through `this`', () => {
    const func = jest.fn().mockReturnThis()
    const debounced = debounce(func, 0)
    const obj = {}
    expect(debounced.call(obj)).toBeUndefined()
    jest.advanceTimersByTime(1000)
    expect(debounced.call(obj)).toBe(obj)
  })

  it('should allow to cancel', () => {
    const func = jest.fn()
    const debounced = debounce(func, 1000)
    debounced()
    jest.advanceTimersByTime(500)
    expect(debounced.cancel()).toBe(true)
    expect(debounced.cancel()).toBe(false)
    jest.advanceTimersByTime(500)
    expect(func).toBeCalledTimes(0)
    jest.advanceTimersByTime(1000)
    expect(func).toBeCalledTimes(0)
    debounced()
    jest.advanceTimersByTime(1000)
    expect(func).toBeCalledTimes(1)
  })

  it('should execute once immediately if intervals are less than wait', () => {
    const func = jest.fn()
    const debounced = debounce(func, { delay: 1000, immediate: true })
    debounced()
    expect(func).toBeCalledTimes(1)
    for (let i = 0; i < 10; i++) {
      jest.advanceTimersByTime(500)
      debounced()
    }
    expect(func).toBeCalledTimes(1)
  })

  it(`should execute once immediately and once at the end with long enough intervals`, () => {
    const func = jest.fn()
    const debounced = debounce(func, { delay: 1000, immediate: true })
    debounced()
    expect(func).toBeCalledTimes(1)
    for (let i = 0; i < 10; i++) {
      jest.advanceTimersByTime(500)
      debounced()
    }
    expect(func).toBeCalledTimes(1)
    jest.advanceTimersByTime(1000)
    debounced()
    expect(func).toBeCalledTimes(2)
  })
})
