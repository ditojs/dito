import { assertType, describe, expectTypeOf, it } from 'vitest'
import type {
  isArray,
  isPlainObject,
  isFunction,
  isNumber,
  isString,
  isBoolean,
  isDate,
  isRegExp,
  isPromise,
  isAsync,
  isArrayLike,
  asObject,
  asArray,
  asFunction
} from '../index.d.ts'

describe('type guards', () => {
  it('isArray narrows unknown to any[]', () => {
    const guard = {} as typeof isArray
    const val: unknown = []
    if (guard(val)) {
      expectTypeOf(val).toEqualTypeOf<any[]>()
    }
  })

  it('isPlainObject narrows union to record', () => {
    const guard = {} as typeof isPlainObject
    const val: string | Record<string, unknown> = {} as any
    if (guard(val)) {
      expectTypeOf(val).not.toBeAny()
      expectTypeOf(val).toEqualTypeOf<
        Record<string, unknown>
      >()
    }
  })

  it('isFunction narrows to callable', () => {
    const guard = {} as typeof isFunction
    const val: string | (() => void) = {} as any
    if (guard(val)) {
      expectTypeOf(val).not.toBeAny()
      expectTypeOf(val).toBeCallableWith()
    }
  })

  it('isNumber narrows union', () => {
    const guard = {} as typeof isNumber
    const val: string | number = {} as any
    if (guard(val)) {
      expectTypeOf(val).not.toBeAny()
      expectTypeOf(val).toBeNumber()
    }
  })

  it('isString narrows union', () => {
    const guard = {} as typeof isString
    const val: number | string = {} as any
    if (guard(val)) {
      expectTypeOf(val).not.toBeAny()
      assertType<string | String>(val)
    }
  })

  it('isBoolean narrows union', () => {
    const guard = {} as typeof isBoolean
    const val: string | boolean = {} as any
    if (guard(val)) {
      expectTypeOf(val).not.toBeAny()
      expectTypeOf(val).toBeBoolean()
    }
  })

  it('isDate narrows to Date', () => {
    const guard = {} as typeof isDate
    const val: string | Date = {} as any
    if (guard(val)) {
      expectTypeOf(val).not.toBeAny()
      expectTypeOf(val).toEqualTypeOf<Date>()
    }
  })

  it('isRegExp narrows to RegExp', () => {
    const guard = {} as typeof isRegExp
    const val: string | RegExp = {} as any
    if (guard(val)) {
      expectTypeOf(val).not.toBeAny()
      expectTypeOf(val).toEqualTypeOf<RegExp>()
    }
  })

  it('isPromise narrows to Promise', () => {
    const guard = {} as typeof isPromise
    const val: string | Promise<number> = {} as any
    if (guard(val)) {
      expectTypeOf(val).not.toBeAny()
      assertType<Promise<any>>(val)
    }
  })

  it('isAsync narrows to async function', () => {
    const guard = {} as typeof isAsync
    const val: (() => void) | (() => Promise<string>) =
      {} as any
    if (guard(val)) {
      expectTypeOf(val).not.toBeAny()
      assertType<(...args: any[]) => Promise<any>>(val)
    }
  })

  it('isArrayLike narrows to ArrayLike', () => {
    const guard = {} as typeof isArrayLike
    const val: string | ArrayLike<number> = {} as any
    if (guard(val)) {
      expectTypeOf(val).not.toBeAny()
      expectTypeOf(val).toHaveProperty('length')
    }
  })
})

describe('asObject', () => {
  it('preserves object types', () => {
    const fn = {} as typeof asObject
    const obj = { a: 1 }
    const result = fn(obj)
    expectTypeOf(result).not.toBeAny()
    expectTypeOf(result).toHaveProperty('a')
  })

  it('returns null/undefined as-is', () => {
    const fn = {} as typeof asObject
    expectTypeOf(fn(null)).toBeNull()
    expectTypeOf(fn(undefined)).toBeUndefined()
  })
})

describe('asArray', () => {
  it('passes arrays through unchanged', () => {
    const fn = {} as typeof asArray
    const arr = [1, 2, 3]
    const result = fn(arr)
    expectTypeOf(result).not.toBeAny()
    expectTypeOf(result).toEqualTypeOf<number[]>()
  })

  it('wraps non-array in array', () => {
    const fn = {} as typeof asArray
    const result = fn('hello')
    expectTypeOf(result).not.toBeAny()
    expectTypeOf(result).toEqualTypeOf<string[]>()
  })

  it('returns empty array for undefined', () => {
    const fn = {} as typeof asArray
    expectTypeOf(fn(undefined)).toEqualTypeOf<never[]>()
  })
})

describe('asFunction', () => {
  it('passes functions through unchanged', () => {
    const fn = {} as typeof asFunction
    const cb = (x: number) => x * 2
    const result = fn(cb)
    expectTypeOf(result).not.toBeAny()
    expectTypeOf(result).toEqualTypeOf<
      (x: number) => number
    >()
  })

  it('wraps non-function in thunk', () => {
    const fn = {} as typeof asFunction
    const result = fn(42)
    expectTypeOf(result).not.toBeAny()
    expectTypeOf(result).toEqualTypeOf<() => number>()
  })
})
