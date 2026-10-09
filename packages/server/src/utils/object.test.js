import {
  getAllKeys,
  getOwnProperty,
  createLookup,
  mergeReversed,
  mergeReversedOrNull,
  mergeAsReversedArrays,
  getInheritanceChain,
  setupPropertyInheritance
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

describe('mergeReversedOrNull()', () => {
  it('merges property values in reversed order', () => {
    expect(mergeReversedOrNull([{ a: 2 }, { a: 1, b: 1 }])).toEqual({
      a: 2,
      b: 1
    })
  })

  it('returns null when the merged object is empty', () => {
    expect(mergeReversedOrNull([])).toBe(null)
    expect(mergeReversedOrNull([{}, null, undefined])).toBe(null)
  })

  it('does not modify the passed array', () => {
    const objects = [{ a: 1 }, { b: 2 }]
    mergeReversedOrNull(objects)
    expect(objects).toEqual([{ a: 1 }, { b: 2 }])
  })
})

describe('getInheritanceChain()', () => {
  it('returns the prototype chain up to Object.prototype', () => {
    class Author {}
    class Editor extends Author {}
    const editor = new Editor()
    expect(getInheritanceChain(editor)).toEqual([
      editor,
      Editor.prototype,
      Author.prototype
    ])
  })

  it('includes Function.prototype for class constructors', () => {
    class Author {}
    class Editor extends Author {}
    expect(getInheritanceChain(Editor)).toEqual([
      Editor,
      Author,
      Function.prototype
    ])
  })

  it('returns an empty array for nullish values', () => {
    expect(getInheritanceChain(null)).toEqual([])
    expect(getInheritanceChain(undefined)).toEqual([])
  })

  it('stops at objects without a prototype', () => {
    const object = Object.create(null)
    expect(getInheritanceChain(object)).toEqual([object])
  })
})

describe('setupPropertyInheritance()', () => {
  it('chains the property values along the class hierarchy', () => {
    class Book {
      static labels = { title: 'Title', isbn: 'ISBN' }
    }
    class Novel extends Book {
      static labels = { genre: 'Genre' }
    }
    class Thriller extends Novel {
      static labels = { title: 'Thriller title' }
    }
    const labels = setupPropertyInheritance(Thriller, 'labels')
    expect(labels).toBe(Thriller.labels)
    expect(labels.title).toBe('Thriller title')
    expect(labels.genre).toBe('Genre')
    expect(labels.isbn).toBe('ISBN')
    expect(Object.keys(labels)).toEqual(['title'])
    expect(Object.getPrototypeOf(Novel.labels)).toBe(Book.labels)
  })

  it('inherits the topmost value from the base value', () => {
    const baseValue = { fallback: true }
    class Book {
      static labels = { title: 'Title' }
    }
    class Novel extends Book {
      static labels = { genre: 'Genre' }
    }
    const labels = setupPropertyInheritance(Novel, 'labels', baseValue)
    expect(labels.fallback).toBe(true)
    expect(Object.getPrototypeOf(Book.labels)).toBe(baseValue)
  })

  it('creates an inheriting object if no class defines the property', () => {
    const baseValue = { fallback: true }
    class Book {}
    const labels = setupPropertyInheritance(Book, 'labels', baseValue)
    expect(Object.hasOwn(Book, 'labels')).toBe(true)
    expect(labels).not.toBe(baseValue)
    expect(Object.getPrototypeOf(labels)).toBe(baseValue)
    expect(labels.fallback).toBe(true)
  })

  it('skips classes that do not define the property themselves', () => {
    class Book {
      static labels = { title: 'Title' }
    }
    class Novel extends Book {}
    class Thriller extends Novel {
      static labels = { genre: 'Genre' }
    }
    const labels = setupPropertyInheritance(Thriller, 'labels')
    expect(Object.getPrototypeOf(labels)).toBe(Book.labels)
    expect(labels.title).toBe('Title')
  })

  it('returns the inherited value if only a parent defines it', () => {
    class Book {
      static labels = { title: 'Title' }
    }
    class Novel extends Book {}
    expect(setupPropertyInheritance(Novel, 'labels', { base: 1 })).toBe(
      Book.labels
    )
  })

  it('returns undefined without any value and base value', () => {
    class Book {}
    expect(setupPropertyInheritance(Book, 'labels')).toBeUndefined()
  })
})
