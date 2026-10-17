import { toCallback } from './toCallback.js'
import { vi } from 'vitest'

describe('toCallback()', () => {
  it('should convert async functions to callbacks', async () => {
    expect.assertions(2)
    const callback = toCallback(async result => {
      await Promise.resolve()
      return result
    })
    const expected = 10
    callback(expected, (err, actual) => {
      expect(err).toBeNull()
      expect(actual).toBe(expected)
    })
  })

  it('should convert async exceptions to callback errors', async () => {
    expect.assertions(2)
    const error = new Error('This error is intentional')
    const callback = toCallback(async error => {
      await Promise.resolve()
      throw error
    })
    callback(error, (err, actual) => {
      expect(err).toBe(error)
      expect(actual).toBe(undefined)
    })
  })

  it('should convert sync exceptions to callback errors', async () => {
    const error = new Error('This error is intentional')
    const done = vi.fn()
    const callback = toCallback(() => {
      throw error
    })
    await callback(done)
    expect(done).toHaveBeenCalledExactlyOnceWith(error)
  })

  it('should not call the callback again when it throws', async () => {
    const error = new Error('This error is intentional')
    const done = vi.fn(() => {
      throw error
    })
    const callback = toCallback(async () => 10)
    await expect(callback(done)).rejects.toBe(error)
    expect(done).toHaveBeenCalledExactlyOnceWith(null, 10)
  })
})
