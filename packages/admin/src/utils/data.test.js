import {
  appendDataPath,
  getRelativeDataPath,
  getParentDataPath,
  getItemDataPath,
  getParentItemDataPath,
  getItem,
  getParentItem,
  getLastDataPathName,
  getLastDataPathIndex,
  setTemporaryId,
  isTemporaryId,
  isReference
} from './data.js'

describe('getRelativeDataPath()', () => {
  it('returns the part of the data path inside the parent data path', () => {
    expect(getRelativeDataPath('chapters/0/title', 'chapters')).toBe(
      '0/title'
    )
    expect(getRelativeDataPath('chapters/0', '')).toBe('chapters/0')
  })

  it('returns an empty string for the same data paths', () => {
    expect(getRelativeDataPath('chapters', 'chapters')).toBe('')
    expect(getRelativeDataPath('', '')).toBe('')
  })

  it('returns `null` for data paths outside the parent data path', () => {
    expect(getRelativeDataPath('chapters', 'chapters/0')).toBe(null)
    expect(getRelativeDataPath('chaptersList/0', 'chapters')).toBe(null)
    expect(getRelativeDataPath('chapters', undefined)).toBe(null)
    expect(getRelativeDataPath(undefined, 'chapters')).toBe(null)
  })

  it('normalizes the data paths', () => {
    expect(getRelativeDataPath('chapters[0].title', 'chapters/')).toBe(
      '0/title'
    )
  })
})

const library = {
  name: 'City Library',
  books: [
    {
      id: 1,
      title: 'Orlando',
      chapters: [{ title: 'One' }, { title: 'Two' }]
    }
  ]
}

describe('appendDataPath()', () => {
  it('appends tokens, without a separator for empty data paths', () => {
    expect(appendDataPath('books', 0)).toBe('books/0')
    expect(appendDataPath('', 'books')).toBe('books')
    expect(appendDataPath(null, 'books')).toBe('books')
  })
})

describe('getParentDataPath()', () => {
  it('removes the last token', () => {
    expect(getParentDataPath('books/0/title')).toBe('books/0')
    expect(getParentDataPath('books[0].title')).toBe('books/0')
    expect(getParentDataPath('books')).toBe('')
  })
})

describe('getItemDataPath()', () => {
  it('returns the data path itself for components with their own item', () => {
    expect(getItemDataPath('books/0')).toBe('books/0')
  })

  it('returns the parent data path for nested components', () => {
    expect(getItemDataPath('books/0/title', true)).toBe('books/0')
  })
})

describe('getParentItemDataPath()', () => {
  it('skips the indices of lists to reach the item holding the list', () => {
    expect(getParentItemDataPath('books/0/chapters/1')).toBe('books/0')
    expect(getParentItemDataPath('books/0')).toBe('')
  })

  it('removes the name of nested components first', () => {
    expect(getParentItemDataPath('books/0/chapters/1/title', true)).toBe(
      'books/0'
    )
  })

  it('removes the last name of nested objects', () => {
    expect(getParentItemDataPath('books/0/cover')).toBe('books/0')
  })

  it('returns `null` for the root item', () => {
    expect(getParentItemDataPath('')).toBe(null)
    expect(getParentItemDataPath('title', true)).toBe(null)
  })

  it('returns `null` without a data path', () => {
    expect(getParentItemDataPath(undefined)).toBe(null)
    expect(getParentItem(library, null)).toBe(null)
  })
})

describe('getItem()', () => {
  it('returns the item at the data path', () => {
    expect(getItem(library, 'books/0/chapters/1')).toEqual({ title: 'Two' })
    expect(getItem(library, '')).toBe(library)
  })

  it('returns the item holding nested components', () => {
    expect(getItem(library, 'books/0/title', true)).toBe(library.books[0])
  })

  it('returns `null` for data paths missing in the root item', () => {
    expect(getItem(library, 'books/5/chapters/0')).toBe(null)
  })

  it('returns `null` without a data path', () => {
    expect(getItem(library, undefined)).toBe(null)
  })
})

describe('getParentItem()', () => {
  it('returns the item holding the list of the item', () => {
    expect(getParentItem(library, 'books/0/chapters/1')).toBe(
      library.books[0]
    )
    expect(getParentItem(library, 'books/0')).toBe(library)
  })

  it('returns the parent item of nested components', () => {
    expect(getParentItem(library, 'books/0/chapters/1/title', true)).toBe(
      library.books[0]
    )
  })

  it('returns `null` for the root item', () => {
    expect(getParentItem(library, '')).toBe(null)
  })

  it('returns `null` for data paths missing in the root item', () => {
    expect(getParentItem(library, 'books/5/chapters/0')).toBe(null)
  })
})

describe('getLastDataPathName()', () => {
  it('returns the last token if it is a name', () => {
    expect(getLastDataPathName('books/0/title')).toBe('title')
    expect(getLastDataPathName('books/0')).toBe(null)
    expect(getLastDataPathName('')).toBe(null)
  })
})

describe('getLastDataPathIndex()', () => {
  it('returns the last token as a number if it is an index', () => {
    expect(getLastDataPathIndex('books/12')).toBe(12)
    expect(getLastDataPathIndex('books[3]')).toBe(3)
    expect(getLastDataPathIndex('books/0/title')).toBe(null)
    expect(getLastDataPathIndex('')).toBe(null)
  })

  it('returns `null` for missing data paths, e.g. of the root item', () => {
    expect(getLastDataPathIndex(null)).toBe(null)
  })
})

describe('setTemporaryId()', () => {
  it('sets unique temporary ids under the id key', () => {
    const first = {}
    const second = {}
    setTemporaryId(first)
    setTemporaryId(second, 'key')
    expect(isTemporaryId(first.id)).toBe(true)
    expect(isTemporaryId(second.key)).toBe(true)
    expect(first.id).not.toBe(second.key)
  })
})

describe('isTemporaryId()', () => {
  it('recognizes ids starting with `@`', () => {
    expect(isTemporaryId('@1')).toBe(true)
    expect(isTemporaryId('1')).toBe(false)
    expect(isTemporaryId(1)).toBe(false)
    expect(isTemporaryId('user@example.com')).toBe(false)
  })
})

describe('isReference()', () => {
  it('recognizes objects that hold nothing but an id', () => {
    expect(isReference({ id: 1 })).toBe(true)
    expect(isReference({ key: 'a' }, 'key')).toBe(true)
    expect(isReference({ id: 1, title: 'Orlando' })).toBe(false)
    expect(isReference({ id: null })).toBe(false)
    expect(isReference({ title: 'Orlando' })).toBe(false)
    expect(isReference(null)).toBe(false)
  })
})
