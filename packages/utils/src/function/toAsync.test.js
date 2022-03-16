import { toAsync } from './toAsync.js'

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
    const error = new Error('This error is intentional')
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
