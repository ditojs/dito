import { pick } from './pick.js'

// Partially based on:
// https://github.com/lodash/lodash/blob/4.17.11/test/test.js

describe('pick()', () => {
  it(`should return the first value that isn't undefined`, () => {
    expect(pick(10)).toBe(10)
    expect(pick(10, undefined)).toBe(10)
    expect(pick(undefined, 10)).toBe(10)
    expect(pick(undefined, undefined, 10)).toBe(10)
  })

  it('should consider null as defined', () => {
    expect(pick(null)).toBeNull()
    expect(pick(undefined, null)).toBeNull()
  })

  it('should return undefined if nothing is defined', () => {
    expect(pick()).toBeUndefined()
    expect(pick(undefined)).toBeUndefined()
  })
})
