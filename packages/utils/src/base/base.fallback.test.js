import { vi } from 'vitest'

// Exercises the fallbacks used when `Object.is()` and `Number.isInteger()`
// are missing, by re-importing the module with both built-ins removed.

describe('base fallbacks', () => {
  let is
  let isInteger

  beforeAll(async () => {
    const { is: originalIs } = Object
    const { isInteger: originalIsInteger } = Number
    delete Object.is
    delete Number.isInteger
    try {
      vi.resetModules()
      ;({ is, isInteger } = await import('./base.js'))
    } finally {
      Object.is = originalIs
      Number.isInteger = originalIsInteger
    }
  })

  it('should use the fallbacks instead of the built-ins', () => {
    expect(is).not.toBe(Object.is)
    expect(isInteger).not.toBe(Number.isInteger)
  })

  describe('is()', () => {
    it('should implement the SameValue algorithm', () => {
      expect(is(1, 1)).toBe(true)
      expect(is('a', 'a')).toBe(true)
      expect(is(1, '1')).toBe(false)
      expect(is({}, {})).toBe(false)
    })

    it('should distinguish +0 from -0', () => {
      expect(is(0, 0)).toBe(true)
      expect(is(-0, -0)).toBe(true)
      expect(is(0, -0)).toBe(false)
      expect(is(-0, 0)).toBe(false)
    })

    it('should treat NaN as equal to itself', () => {
      expect(is(NaN, NaN)).toBe(true)
      expect(is(NaN, 0)).toBe(false)
      expect(is(0, NaN)).toBe(false)
    })
  })

  describe('isInteger()', () => {
    it('should accept integers', () => {
      expect(isInteger(0)).toBe(true)
      expect(isInteger(-12)).toBe(true)
      expect(isInteger(1e3)).toBe(true)
    })

    it('should reject fractions, infinities and non-numbers', () => {
      expect(isInteger(1.5)).toBe(false)
      expect(isInteger(Infinity)).toBe(false)
      expect(isInteger(NaN)).toBe(false)
      expect(isInteger('1')).toBe(false)
      expect(isInteger(null)).toBe(false)
    })
  })
})
