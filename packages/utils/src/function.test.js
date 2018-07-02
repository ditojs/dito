import { toCallback, toAsync } from './function'

describe('toCallback()', () => {
  it('should convert async functions to callbacks', () => {
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

  it('should convert async exceptions to callback errors', () => {
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
    const asyncFunc = toAsync(function(result, callback) {
      process.nextTick(() => {
        callback(null, result)
      })
    })
    const expected = 10
    const actual = await asyncFunc(expected)
    expect(actual).toBe(expected)
  })

  it('should convert callback errors to exceptions', async () => {
    const error = new Error(`This error is intentional`)
    const asyncFunc = toAsync(function(callback) {
      process.nextTick(() => {
        callback(error)
      })
    })
    expect(asyncFunc()).rejects.toThrow(error)
  })
})
