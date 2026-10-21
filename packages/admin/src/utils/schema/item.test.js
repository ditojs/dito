import { html } from '@ditojs/utils'
import { defineType } from './types.ts'
import {
  getItemIdOrIndex,
  findItemIndexById,
  getItemLabel
} from './item.js'

defineType({ type: 'list', sourceType: 'list' })
defineType({ type: 'object', sourceType: 'object' })

const listSchema = { type: 'list', idKey: 'id' }
const books = [{ id: 7, title: 'Emma' }, { id: 9, title: 'Persuasion' }]

describe('getItemIdOrIndex()', () => {
  it('returns the ids of stored items', () => {
    const options = { index: 1, isTransient: false }
    expect(getItemIdOrIndex(listSchema, books[1], options)).toBe('9')
  })

  it('returns the indices of transient items', () => {
    const options = { index: 1, isTransient: true }
    expect(getItemIdOrIndex(listSchema, books[1], options)).toBe('1')
  })

  it('falls back on the ids of transient items without index', () => {
    const options = { isTransient: true }
    expect(getItemIdOrIndex(listSchema, books[1], options)).toBe('9')
  })
})

describe('findItemIndexById()', () => {
  it('finds stored items by their ids', () => {
    const options = { isTransient: false }
    expect(findItemIndexById(listSchema, books, '9', options)).toBe(1)
    expect(findItemIndexById(listSchema, books, '3', options)).toBe(null)
    expect(findItemIndexById(listSchema, null, '9', options)).toBe(null)
  })

  it('addresses transient items by their indices', () => {
    const options = { isTransient: true }
    expect(findItemIndexById(listSchema, books, '1', options)).toBe('1')
  })
})

describe('getItemLabel()', () => {
  const getFormLabel = () => 'Book'
  const getLabelObject = (sourceSchema, item, options = {}) =>
    getItemLabel(sourceSchema, item, {
      getFormLabel,
      getDisplayValue: key => item[key],
      evaluateItemLabel: () => sourceSchema.itemLabel({ item }),
      ...options
    })
  // Item labels are `html`, except for objects:
  const getLabel = (sourceSchema, item, options = {}) => (
    getLabelObject(sourceSchema, item, options)?.value ?? null
  )

  it('escapes the values of items', () => {
    const schema = { type: 'list', itemLabel: 'title' }
    expect(getLabel(schema, { title: '<b>Tom & Jerry</b>' })).toBe(
      '&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;'
    )
  })

  it('extends escaped values with the form label', () => {
    const schema = { type: 'list', itemLabel: 'title' }
    expect(
      getLabel(schema, { title: 'Tom & Jerry' }, { extended: true })
    ).toBe(`Book 'Tom &amp; Jerry'`)
  })

  it('escapes the text that `itemLabel()` returns', () => {
    const schema = {
      type: 'list',
      itemLabel: ({ item }) => `<b>${item.id}</b> & co`
    }
    expect(getLabel(schema, books[0], { extended: true })).toBe(
      '&lt;b&gt;7&lt;/b&gt; &amp; co'
    )
  })

  it('keeps the HTML that `itemLabel()` returns with `html`', () => {
    const schema = {
      type: 'list',
      itemLabel: ({ item }) => html`<b>${item.id}</b> &amp; ${'<i>'}`
    }
    expect(getLabel(schema, books[0], { extended: true })).toBe(
      '<b>7</b> &amp; &lt;i&gt;'
    )
  })

  it('extends `html` form labels with escaped values', () => {
    const schema = { type: 'list', itemLabel: 'title' }
    expect(
      getLabel(
        schema,
        { title: '<i>Emma</i>' },
        {
          extended: true,
          getFormLabel: () => html`<b>Book</b>`
        }
      )
    ).toBe(`<b>Book</b> '&lt;i&gt;Emma&lt;/i&gt;'`)
  })

  it('uses numeric values of items as labels', () => {
    const schema = { type: 'list', itemLabel: 'year' }
    expect(getLabel(schema, { year: 1815 })).toBe('1815')
    expect(getLabel(schema, { year: 1815 }, { extended: true })).toBe(
      `Book '1815'`
    )
  })

  it('uses `itemLabel` as the label if the item has no such key', () => {
    expect(getLabel({ type: 'list', itemLabel: 'Untitled' }, {})).toBe(
      'Untitled'
    )
    expect(getLabel({ type: 'list', itemLabel: 'Q & A' }, {})).toBe(
      'Q &amp; A'
    )
  })

  it('uses the first column, or else the name of items', () => {
    const columns = { title: {}, year: {} }
    expect(getLabel({ type: 'list', columns }, books[0])).toBe('Emma')
    expect(
      getLabel({ type: 'list', columns: ['title', 'year'] }, books[0])
    ).toBe('Emma')
    expect(
      getLabel({ type: 'list', columns: [{ name: 'title' }] }, books[0])
    ).toBe('Emma')
    expect(getLabel({ type: 'object' }, { name: 'Jane' })).toBe('Jane')
  })

  it('numbers items without label with the form label', () => {
    const schema = { type: 'list' }
    expect(getLabel(schema, { title: 'Emma' }, { index: 2 })).toBe('Book 3')
    expect(getLabel(schema, { name: { first: 'Jane' } })).toBe('Book ')
  })

  it('omits labels for `itemLabel: false` unless extended', () => {
    const schema = { type: 'list', itemLabel: false }
    expect(getLabel(schema, books[0])).toBe(null)
    expect(getLabel(schema, null)).toBe(null)
  })

  it('returns labels with prefix and suffix as objects', () => {
    const schema = {
      type: 'list',
      itemLabel: () => ({ text: 'Tom & Jerry', prefix: '1.' })
    }
    expect(getLabelObject(schema, books[0], { asObject: true })).toEqual({
      text: html`${'Tom & Jerry'}`,
      prefix: '1.',
      suffix: undefined
    })
    expect(
      getLabelObject(
        {
          type: 'list',
          itemLabel: () => ({ text: html`<b>Emma</b>`, suffix: 1 })
        },
        books[0],
        { asObject: true }
      )
    ).toEqual({ text: html`<b>Emma</b>`, prefix: undefined, suffix: 1 })
    expect(
      getLabelObject(
        { type: 'list', itemLabel: () => ({ prefix: '1.' }) },
        books[0],
        { index: 0, asObject: true }
      )
    ).toEqual({ text: html`Book 1`, prefix: '1.', suffix: undefined })
    expect(
      getLabelObject(
        { type: 'list' },
        {},
        {
          asObject: true,
          getFormLabel: () => ''
        }
      )
    ).toBe(null)
  })
})
