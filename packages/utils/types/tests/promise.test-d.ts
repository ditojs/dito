import { describe, expectTypeOf, it } from 'vitest'
import type { mapConcurrently, mapSequentially } from '../index.d.ts'

describe('mapConcurrently', () => {
  it('infers callback param from input array type', () => {
    const fn = {} as typeof mapConcurrently
    fn([1, 2, 3], async (value, index, array) => {
      expectTypeOf(value).not.toBeAny()
      expectTypeOf(value).toBeNumber()
      expectTypeOf(index).toBeNumber()
      expectTypeOf(array).toEqualTypeOf<number[]>()
      return String(value)
    })
  })

  it('result type matches callback return', () => {
    const fn = {} as typeof mapConcurrently
    const result = fn(
      [1, 2],
      async value => ({ doubled: value * 2 })
    )
    expectTypeOf(result)
      .resolves.items.not.toBeAny()
    expectTypeOf(result)
      .resolves.items.toEqualTypeOf<{ doubled: number }>()
  })

  it('accepts promise input', () => {
    const fn = {} as typeof mapConcurrently
    const input = Promise.resolve(['a', 'b'])
    fn(input, async value => {
      expectTypeOf(value).not.toBeAny()
      expectTypeOf(value).toBeString()
      return value.length
    })
  })

  it('accepts synchronous callback', () => {
    const fn = {} as typeof mapConcurrently
    const result = fn([1, 2], value => `${value}`)
    expectTypeOf(result).resolves.items.not.toBeAny()
    expectTypeOf(result).resolves.items.toBeString()
  })
})

describe('mapSequentially', () => {
  it('infers callback param from input array type', () => {
    const fn = {} as typeof mapSequentially
    fn(['a', 'b'], async (value, index) => {
      expectTypeOf(value).not.toBeAny()
      expectTypeOf(value).toBeString()
      expectTypeOf(index).toBeNumber()
      return value.length
    })
  })

  it('result type matches callback return', () => {
    const fn = {} as typeof mapSequentially
    const result = fn(
      [{ id: 1 }],
      async item => item.id
    )
    expectTypeOf(result).resolves.items.not.toBeAny()
    expectTypeOf(result).resolves.items.toBeNumber()
  })
})
