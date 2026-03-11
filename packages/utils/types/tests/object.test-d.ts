import { describe, expectTypeOf, it } from 'vitest'
import type {
  clone,
  groupBy,
  mergeDeeply,
  assignDeeply,
  pick,
  pickBy,
  mapKeys,
  mapValues
} from '../index.d.ts'

describe('clone', () => {
  it('preserves the input type', () => {
    const fn = {} as typeof clone
    const obj = { a: 1, b: 'hello' }
    const result = fn(obj)
    expectTypeOf(result).not.toBeAny()
    expectTypeOf(result).toEqualTypeOf<typeof obj>()
  })

  it('processValue callback receives correct type', () => {
    const fn = {} as typeof clone
    fn({ x: 1 }, {
      processValue(value) {
        expectTypeOf(value).not.toBeAny()
        expectTypeOf(value).toEqualTypeOf<{ x: number }>()
        return value
      }
    })
  })
})

describe('groupBy', () => {
  it('infers callback param type from array', () => {
    const fn = {} as typeof groupBy
    const items = [
      { name: 'a', category: 'x' },
      { name: 'b', category: 'y' }
    ]
    fn(items, item => {
      expectTypeOf(item).not.toBeAny()
      expectTypeOf(item).toEqualTypeOf<{
        name: string
        category: string
      }>()
      return item.category
    })
  })

  it('accepts property key shorthand', () => {
    const fn = {} as typeof groupBy
    const items = [{ type: 'a' as const, v: 1 }]
    const result = fn(items, 'type')
    expectTypeOf(result).not.toBeAny()
    expectTypeOf(result).toEqualTypeOf<
      Record<string, { type: 'a'; v: number }[]>
    >()
  })

  it('works with record input', () => {
    const fn = {} as typeof groupBy
    const obj: Record<string, { group: string }> = {}
    fn(obj, item => {
      expectTypeOf(item).not.toBeAny()
      expectTypeOf(item).toEqualTypeOf<{ group: string }>()
      return item.group
    })
  })
})

describe('mergeDeeply', () => {
  it('produces intersection of two args', () => {
    const fn = {} as typeof mergeDeeply
    const result = fn(
      {} as { a: number },
      {} as { b: string }
    )
    expectTypeOf(result).not.toBeAny()
    expectTypeOf(result).toHaveProperty('a')
    expectTypeOf(result).toHaveProperty('b')
  })

  it('produces intersection of three args', () => {
    const fn = {} as typeof mergeDeeply
    const result = fn(
      {} as { a: number },
      {} as { b: string },
      {} as { c: boolean }
    )
    expectTypeOf(result).not.toBeAny()
    expectTypeOf(result).toHaveProperty('a')
    expectTypeOf(result).toHaveProperty('b')
    expectTypeOf(result).toHaveProperty('c')
  })
})

describe('assignDeeply', () => {
  it('produces intersection of two args', () => {
    const fn = {} as typeof assignDeeply
    const result = fn(
      {} as { a: number },
      {} as { b: string }
    )
    expectTypeOf(result).not.toBeAny()
    expectTypeOf(result).toHaveProperty('a')
    expectTypeOf(result).toHaveProperty('b')
  })
})

describe('pick', () => {
  it('returns union of argument types', () => {
    const fn = {} as typeof pick
    const result = fn(
      {} as number | undefined,
      {} as string
    )
    expectTypeOf(result).not.toBeAny()
    expectTypeOf(result).toEqualTypeOf<
      number | undefined | string
    >()
  })
})

describe('pickBy', () => {
  it('callback receives value, key, and object', () => {
    const fn = {} as typeof pickBy
    const obj: Record<string, number> = {}
    fn(obj, (value, key, source) => {
      expectTypeOf(value).not.toBeAny()
      expectTypeOf(value).toBeNumber()
      expectTypeOf(key).toBeString()
      expectTypeOf(source).toEqualTypeOf(obj)
      return value > 1
    })
  })

  it('returns partial of input type', () => {
    const fn = {} as typeof pickBy
    const obj = {} as { a: number; b: number }
    const result = fn(obj, () => true)
    expectTypeOf(result).not.toBeAny()
    expectTypeOf(result).toEqualTypeOf<
      Partial<{ a: number; b: number }>
    >()
  })
})

describe('mapKeys', () => {
  it('callback receives key, value, and object', () => {
    const fn = {} as typeof mapKeys
    const obj: Record<string, number> = {}
    fn(obj, (key, value, source) => {
      expectTypeOf(value).not.toBeAny()
      expectTypeOf(key).toBeString()
      expectTypeOf(value).toBeNumber()
      expectTypeOf(source).toEqualTypeOf(obj)
      return `prefix_${key}`
    })
  })
})

describe('mapValues', () => {
  it('callback receives value, key, and object', () => {
    const fn = {} as typeof mapValues
    const obj: Record<string, number> = {}
    fn(obj, (value, key, source) => {
      expectTypeOf(value).not.toBeAny()
      expectTypeOf(value).toBeNumber()
      expectTypeOf(key).toBeString()
      expectTypeOf(source).toEqualTypeOf(obj)
      return String(value)
    })
  })

  it('result values match callback return type', () => {
    const fn = {} as typeof mapValues
    const obj: Record<string, number> = {}
    const result = fn(obj, value => String(value))
    expectTypeOf(result).not.toBeAny()
    expectTypeOf(result).toEqualTypeOf<
      Record<string, string>
    >()
  })

  it('property shorthand extracts nested value', () => {
    const fn = {} as typeof mapValues
    const obj: Record<string, { nested: number }> = {}
    const result = fn(obj, 'nested')
    expectTypeOf(result).not.toBeAny()
    expectTypeOf(result).toEqualTypeOf<
      Record<string, number>
    >()
  })
})
