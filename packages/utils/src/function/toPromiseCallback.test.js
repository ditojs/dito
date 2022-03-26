import { toPromiseCallback } from './toPromiseCallback.js'
import { vi } from 'vitest'

describe('toPromiseCallback()', () => {
  it('should call reject() when called with an error', () => {
    const error = new Error('My Error')
    const resolve = vi.fn()
    const reject = vi.fn()
    const callback = toPromiseCallback(resolve, reject)
    callback(error)
    expect(resolve).not.toBeCalled()
    expect(reject).toBeCalledWith(error)
  })

  it('should call resolve() when called with a result', () => {
    const result = 42
    const resolve = vi.fn()
    const reject = vi.fn()
    const callback = toPromiseCallback(resolve, reject)
    callback(null, result)
    expect(reject).not.toBeCalled()
    expect(resolve).toBeCalledWith(result)
  })
})
