import {
  getAllKeys, getOwnProperty, createLookup, mergeReversed, mergeAsReversedArrays
} from './object.js'

const object = Object.create({ a: 1 })
object.b = 2

describe('getAllKeys()', () => {
  it('returns all keys, not just own keys', () => {
    expect(getAllKeys(object)).toEqual(['b', 'a'])
  })
})

describe('getOwnProperty()', () => {
  it('only returns own properties', () => {
    expect(getOwnProperty(object, 'a')).toBeUndefined()
    expect(getOwnProperty(object, 'b')).toBe(2)
  })
})

describe('createLookup()', () => {
  it('creates lookup objects out of arrays of strings', () => {
    expect(createLookup(['a', 'b'])).toEqual({
      a: true,
      b: true
    })
  })
})

describe('mergeReversed()', () => {
  it('merges property values in reversed order', () => {
    expect(
      mergeReversed([
        {
          a: 3
        },
        {
          a: 2,
          b: 2
        },
        {
          a: 1,
          b: 1,
          c: 1
        }
      ])
    ).toEqual({
      a: 3,
      b: 2,
      c: 1
    })
  })
})

describe('mergeAsReversedArrays()', () => {
  it('merges property values into arrays', () => {
    expect(
      mergeAsReversedArrays([
        {
          a: 1,
          b: 1,
          c: 1
        },
        {
          a: 2,
          b: 2
        },
        {
          a: 3
        }
      ])
    ).toEqual({
      a: [3, 2, 1],
      b: [2, 1],
      c: [1]
    })
  })
})

describe.skip('setupPropertyInheritance()', () => {
  // TODO: Add unit tests for this!
})
