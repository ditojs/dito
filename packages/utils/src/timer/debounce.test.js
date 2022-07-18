import { debounce } from './debounce.js'
import { vi } from 'vitest'

// Tell vitest to mock all timeout functions:
vi.useFakeTimers()

describe('debounce()', () => {
  const fixture = Symbol('fixture')

  it('should never execute if intervals are less than wait', () => {
    const func = vi.fn()
    const debounced = debounce(func, 1000)
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(500)
      debounced()
    }
    expect(func).toBeCalledTimes(0)
  })

  it('should execute just once if an interval is big enough', () => {
    const func = vi.fn()
    const debounced = debounce(func, 1000)
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(500)
      debounced()
    }
    vi.advanceTimersByTime(1000)
    debounced()
    expect(func).toBeCalledTimes(1)
  })

  it('should pass through argument', async () => {
    const func = vi.fn(value => value)
    const debounced = debounce(func, 1000)
    expect(debounced(fixture)).toBeUndefined()
    vi.advanceTimersByTime(1000)
    expect(debounced()).toBe(fixture)
    expect(func).toBeCalledTimes(1)
  })

  it('should pass through return value', () => {
    const func = vi.fn().mockReturnValue(fixture)
    const debounced = debounce(func, 1000)
    expect(debounced()).toBeUndefined()
    vi.advanceTimersByTime(1000)
    expect(debounced()).toBe(fixture)
    expect(func).toBeCalledTimes(1)
  })

  it('should pass through `this`', () => {
    const func = vi.fn().mockReturnThis()
    const debounced = debounce(func, 0)
    const obj = {}
    expect(debounced.call(obj)).toBeUndefined()
    vi.advanceTimersByTime(1000)
    expect(debounced.call(obj)).toBe(obj)
  })

  it('should allow to cancel', () => {
    const func = vi.fn()
    const debounced = debounce(func, 1000)
    debounced()
    vi.advanceTimersByTime(500)
    expect(debounced.cancel()).toBe(true)
    expect(debounced.cancel()).toBe(false)
    vi.advanceTimersByTime(500)
    expect(func).toBeCalledTimes(0)
    vi.advanceTimersByTime(1000)
    expect(func).toBeCalledTimes(0)
    debounced()
    vi.advanceTimersByTime(1000)
    expect(func).toBeCalledTimes(1)
  })

  it('should execute once immediately if intervals are less than wait', () => {
    const func = vi.fn()
    const debounced = debounce(func, { delay: 1000, immediate: true })
    debounced()
    expect(func).toBeCalledTimes(1)
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(500)
      debounced()
    }
    expect(func).toBeCalledTimes(1)
  })

  it(`should execute once immediately and once at the end with long enough intervals`, () => {
    const func = vi.fn()
    const debounced = debounce(func, { delay: 1000, immediate: true })
    debounced()
    expect(func).toBeCalledTimes(1)
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(500)
      debounced()
    }
    expect(func).toBeCalledTimes(1)
    vi.advanceTimersByTime(1000)
    debounced()
    expect(func).toBeCalledTimes(2)
  })
})
