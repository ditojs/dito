import { clone } from './clone.js'
import { vi } from 'vitest'

describe('clone()', () => {
  it('should clone objects', () => {
    const object = { a: 1, b: 2 }
    const copy = clone(object)
    expect(copy).toEqual(object)
    expect(copy).not.toBe(object)
  })

  it('should clone arrays', () => {
    const array = [1, 2, 3]
    const copy = clone(array)
    expect(copy).toStrictEqual(array)
    expect(copy).not.toBe(array)
  })

  it('should clone dates', () => {
    const date = new Date(2012, 5, 9)
    const copy = clone(date)
    expect(copy).toStrictEqual(date)
    expect(copy).not.toBe(date)
  })

  it('should clone regular expressions', () => {
    const regexp = /regexp/gi
    const copy = clone(regexp)
    expect(copy).toStrictEqual(regexp)
    expect(copy).not.toBe(regexp)
  })

  it('should return functions unmodified', () => {
    const func = () => {}
    expect(clone(func)).toBe(func)
  })

  it('should clone nested objects and arrays', () => {
    const object = { a: [1, 2, 3], b: { c: 4, d: 5 } }
    const copy = clone(object)
    expect(copy).toStrictEqual(object)
    expect(copy).not.toBe(object)
    expect(copy.a).not.toBe(object.a)
    expect(copy.b).not.toBe(object.b)
  })

  it('should use clone() methods if available', () => {
    const object = {
      a: 1,
      clone: vi.fn(() => ({ b: 2 }))
    }
    const copy = clone(object)
    expect(object.clone).toBeCalledTimes(1)
    expect(copy).toStrictEqual({ b: 2 })
  })

  it('should transform cloned values by `callback`', () => {
    const object = {
      a: { b: 1, c: 2 },
      d: { e: 3, f: 4 }
    }
    const copy = clone(object, value => {
      if (typeof value === 'object') {
        value.g = 5
      }
    })
    const expected = {
      a: { b: 1, c: 2, g: 5 },
      d: { e: 3, f: 4, g: 5 },
      g: 5
    }
    expect(copy).toStrictEqual(expected)
  })

  it('should call `callback` after cloning all children', () => {
    const array = [
      { a: 1, b: 2 },
      { a: 3, b: 4 }
    ]
    const copy = clone(array, value => {
      if (typeof value === 'object') {
        delete value.b
      }
    })
    const expected = [
      { a: 1 },
      { a: 3 }
    ]
    expect(copy).toStrictEqual(expected)
  })

  it('should handle promises', async () => {
    const promise = (async () => 1)()
    const result = clone(promise)
    expect(await result).toStrictEqual(1)
  })
})
