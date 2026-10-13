import { describe, expectTypeOf, it } from 'vitest'
import type {
  getValueAtDataPath,
  getEntriesAtDataPath,
  setValueAtDataPath,
  setEntriesAtDataPath,
  normalizeDataPath,
  parseDataPath,
  resolveDataPath
} from '@ditojs/utils'

describe('getValueAtDataPath', () => {
  it('error handler receives correct params', () => {
    const fn = {} as typeof getValueAtDataPath
    fn({}, 'a.b', (obj, part, index) => {
      expectTypeOf(part).not.toBeAny()
      expectTypeOf(part).toBeString()
      expectTypeOf(index).not.toBeAny()
      expectTypeOf(index).toBeNumber()
    })
  })
})

describe('getEntriesAtDataPath', () => {
  it('error handler receives correct params', () => {
    const fn = {} as typeof getEntriesAtDataPath
    fn({}, 'items.*', (obj, part, index) => {
      expectTypeOf(part).not.toBeAny()
      expectTypeOf(part).toBeString()
      expectTypeOf(index).not.toBeAny()
      expectTypeOf(index).toBeNumber()
    })
  })
})

describe('setValueAtDataPath', () => {
  it('preserves the object type', () => {
    const fn = {} as typeof setValueAtDataPath
    const obj = { a: { b: 1 } }
    const result = fn(obj, 'a.b', 2)
    expectTypeOf(result).not.toBeAny()
    expectTypeOf(result).toEqualTypeOf<typeof obj>()
  })
})

describe('setEntriesAtDataPath', () => {
  it('preserves the object type', () => {
    const fn = {} as typeof setEntriesAtDataPath
    const obj = { x: 1, y: 2 }
    const result = fn(obj, { x: 10 })
    expectTypeOf(result).not.toBeAny()
    expectTypeOf(result).toEqualTypeOf<typeof obj>()
  })
})

describe('parseDataPath', () => {
  it('returns string array from string or array input', () => {
    const fn = {} as typeof parseDataPath
    const fromString = fn('a.b.c')
    const fromArray = fn(['a', 'b'])
    expectTypeOf(fromString).not.toBeAny()
    expectTypeOf(fromString).toEqualTypeOf<string[]>()
    expectTypeOf(fromArray).toEqualTypeOf<string[]>()
  })
})

describe('normalizeDataPath', () => {
  it('returns string from string or array input', () => {
    const fn = {} as typeof normalizeDataPath
    const fromString = fn('a.b')
    const fromArray = fn(['a', 'b'])
    expectTypeOf(fromString).not.toBeAny()
    expectTypeOf(fromString).toBeString()
    expectTypeOf(fromArray).toBeString()
  })
})

describe('resolveDataPath', () => {
  it('returns a string', () => {
    const fn = {} as typeof resolveDataPath
    const result = fn('items/0', '../title')
    expectTypeOf(result).not.toBeAny()
    expectTypeOf(result).toBeString()
  })
})
