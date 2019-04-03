import { toCallback, toAsync } from './function'

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
    const error = new Error(`This error is intentional`)
    const callback = toCallback(async error => {
      await Promise.resolve()
      throw error
    })
    callback(error, (err, actual) => {
      expect(err).toBe(error)
      expect(actual).toBe(undefined)
    })
  })
})

describe('toAsync()', () => {
  it('should convert callback functions to async', async () => {
    expect.assertions(1)
    const asyncFunc = toAsync(function(toResolve, callback) {
      process.nextTick(() => {
        callback(null, toResolve)
      })
    })
    const expected = 10
    const actual = await asyncFunc(expected)
    expect(actual).toBe(expected)
  })

  it('should convert callback errors to exceptions', async () => {
    expect.assertions(1)
    const error = new Error(`This error is intentional`)
    const throwError = toAsync(function(toReject, callback) {
      process.nextTick(() => {
        callback(toReject)
      })
    })

    try {
      await throwError(error)
    } catch (err) {
      expect(err).toBe(error)
    }
  })
})
