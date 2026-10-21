import { vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { isFunction } from '@ditojs/utils'
import SchemaContext from '../../SchemaContext.js'
// Importing the types defines them, so the walk sees their descriptors:
import '../../types/index.js'
import { setupForm } from './setup.js'
import { defineType } from './types.ts'
import {
  initializeData,
  deserializeData,
  serializeData,
  isDataPathExcluded,
  getItemDisplayValue
} from './data.js'
import { getDataValidationErrors } from './validation.js'
import { walkData } from './walk.js'
import { DataModel } from '../DataModel.ts'
import { mergeData } from '../mergeData.ts'
import { fromClipboard } from '../fromClipboard.ts'
import { toClipboard } from '../toClipboard.ts'
import { getUploadEntries } from '../interchange.ts'

// The API settings that setting up forms reads, also the forms of `fields()`
// callbacks, which the services hand out:
const api = { defaults: {} }
const services = { adminContext: { api } }

async function createForm(form) {
  return setupForm(api, { type: 'form', ...form })
}

const showPrices = ({ rootItem }) => rootItem.showPrices

// A catalogue with the structures that the walk handles: unnested sections
// with `if`, `fields()` callbacks, items of several forms, wrapped primitives,
// panels, tabs, and sources with their own resource:
const catalogueForm = {
  fields: {
    title: { type: 'text', required: true },
    showPrices: { type: 'switch' },
    secret: { type: 'password' },
    collections: {
      type: 'list',
      inlined: true,
      form: {
        type: 'form',
        fields: {
          name: { type: 'text', required: true },
          code: {
            type: 'text',
            required: ({ item }) => item.items.length > 1
          },
          pricing: {
            type: 'section',
            if: showPrices,
            fields: {
              discount: { type: 'number', range: [0, 1] },
              currency: { type: 'select', options: ['EUR', 'USD'] }
            }
          },
          items: {
            type: 'list',
            inlined: true,
            forms: {
              book: {
                type: 'form',
                fields: {
                  name: { type: 'text', required: true },
                  pages: { type: 'integer', minimum: 1 },
                  onSale: { type: 'switch' },
                  price: {
                    type: 'number',
                    if: showPrices,
                    required: ({ item }) => item.onSale
                  },
                  chapters: {
                    type: 'list',
                    inlined: true,
                    form: {
                      type: 'form',
                      fields: {
                        title: { type: 'text', required: true, maxLength: 20 },
                        length: { type: 'number', default: 1 }
                      }
                    }
                  },
                  tags: {
                    type: 'list',
                    inlined: true,
                    wrapPrimitives: 'tag',
                    form: {
                      type: 'form',
                      fields: { tag: { type: 'text', required: true } }
                    }
                  },
                  details: {
                    type: 'section',
                    fields: ({ item }) =>
                      item.pages > 100
                        ? { summary: { type: 'text', required: true } }
                        : { blurb: { type: 'text', maxLength: 10 } }
                  }
                }
              },
              record: {
                type: 'form',
                fields: {
                  name: { type: 'text', required: true },
                  email: { type: 'email' },
                  format: {
                    type: 'select',
                    options: ['lp', 'cd'],
                    default: 'lp'
                  },
                  tracks: {
                    type: 'list',
                    inlined: true,
                    required: true,
                    form: {
                      type: 'form',
                      fields: {
                        title: { type: 'text', required: true },
                        seconds: { type: 'integer', minimum: 1 }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      panels: {
        summary: {
          type: 'panel',
          fields: { summaryNote: { type: 'text', maxLength: 5 } }
        }
      }
    },
    vendors: {
      type: 'list',
      resource: 'vendors',
      form: {
        type: 'form',
        fields: { name: { type: 'text', required: true } }
      }
    }
  },
  tabs: {
    extra: {
      type: 'tab',
      fields: { notes: { type: 'textarea', maxLength: 5 } }
    }
  }
}

function createCatalogue() {
  return {
    title: '',
    showPrices: true,
    summaryNote: 'Too long',
    notes: 'Too long',
    collections: [
      {
        name: 'Books',
        code: null,
        discount: 2,
        currency: 'GBP',
        items: [
          {
            type: 'book',
            name: '',
            pages: 0,
            onSale: true,
            price: null,
            chapters: [{ title: 'x'.repeat(30) }, { title: 'Two' }],
            tags: ['a', ''],
            blurb: 'Much too long'
          },
          {
            type: 'book',
            name: 'Long',
            pages: 200,
            onSale: false,
            chapters: [],
            tags: []
          }
        ]
      },
      {
        name: '',
        items: [
          {
            type: 'record',
            name: 'Record',
            email: 'nope',
            tracks: []
          }
        ]
      }
    ],
    vendors: [{}]
  }
}

const catalogueErrors = {
  'title': [{ message: 'is required' }],
  'notes': [{ message: 'must be at most 5 characters long' }],
  'summaryNote': [{ message: 'must be at most 5 characters long' }],
  'collections/0/code': [{ message: 'is required' }],
  'collections/0/discount': [{ message: 'must be between 0 and 1' }],
  'collections/0/currency': [{ message: 'must be one of the options' }],
  'collections/0/items/0/name': [{ message: 'is required' }],
  'collections/0/items/0/pages': [{ message: 'must be 1 or more' }],
  'collections/0/items/0/price': [{ message: 'is required' }],
  'collections/0/items/0/chapters/0/title': [
    { message: 'must be at most 20 characters long' }
  ],
  'collections/0/items/0/tags/1': [{ message: 'is required' }],
  'collections/0/items/0/blurb': [
    { message: 'must be at most 10 characters long' }
  ],
  'collections/0/items/1/summary': [{ message: 'is required' }],
  'collections/1/name': [{ message: 'is required' }],
  'collections/1/items/0/email': [{ message: 'must be a valid email' }],
  'collections/1/items/0/tracks': [{ message: 'is required' }]
}

// Add the hook `key` to all schemas, to tell which fields call it:
function addHook(schema, key, hook) {
  const addHooks = schemas =>
    Object.fromEntries(
      Object.entries(schemas).map(([name, schema]) => [
        name,
        addHook(schema, key, hook)
      ])
    )
  const { fields, tabs, panels, form, forms, children } = schema
  return {
    ...schema,
    [key]: hook,
    ...(fields && {
      fields: isFunction(fields)
        ? context => addHooks(fields(context))
        : addHooks(fields)
    }),
    ...(tabs && { tabs: addHooks(tabs) }),
    ...(panels && { panels: addHooks(panels) }),
    ...(form && { form: addHook(form, key, hook) }),
    ...(forms && { forms: addHooks(forms) }),
    ...(children && { children: addHook(children, key, hook) })
  }
}

// The catalogue as it is serialized:
const serializedCatalogue = {
  title: '',
  showPrices: true,
  summaryNote: 'Too long',
  notes: 'Too long',
  collections: [
    {
      name: 'Books',
      code: null,
      discount: 2,
      currency: 'GBP',
      items: [
        {
          type: 'book',
          name: '',
          pages: 0,
          onSale: true,
          price: null,
          chapters: [
            { title: 'x'.repeat(30), length: 1 },
            { title: 'Two', length: 1 }
          ],
          tags: ['a', ''],
          blurb: 'Much too long'
        },
        {
          type: 'book',
          name: 'Long',
          pages: 200,
          onSale: false,
          price: null,
          chapters: [],
          tags: [],
          summary: ''
        }
      ]
    },
    {
      name: '',
      code: '',
      discount: null,
      currency: null,
      items: [
        {
          type: 'record',
          name: 'Record',
          email: 'nope',
          format: 'lp',
          tracks: []
        }
      ]
    }
  ]
}

describe('walkData()', () => {
  it('asks once whether a field is walked, also for its panels', async () => {
    const form = await createForm(catalogueForm)
    const shouldWalk = vi.fn(() => true)
    walkData(form, createCatalogue(), {
      dataPath: '',
      services,
      shouldWalk,
      visit: () => {}
    })
    const dataPaths = shouldWalk.mock.calls.map(([{ dataPath }]) => dataPath)
    expect(dataPaths.filter(dataPath => dataPath === 'collections')).toEqual([
      'collections'
    ])
  })
})

describe('getDataValidationErrors()', () => {
  it('validates the values of all fields that are shown', async () => {
    const form = await createForm(catalogueForm)
    expect(
      getDataValidationErrors(form, createCatalogue(), { services })
    ).toEqual(catalogueErrors)
  })

  it('skips the fields that are hidden, and their items', async () => {
    const form = await createForm(catalogueForm)
    const data = { ...createCatalogue(), showPrices: false }
    const {
      'collections/0/discount': discount,
      'collections/0/currency': currency,
      'collections/0/items/0/price': price,
      ...errors
    } = catalogueErrors
    expect(getDataValidationErrors(form, data, { services })).toEqual(errors)
  })

  it('collects the errors of several fields of the same value', async () => {
    const form = await createForm({
      tabs: {
        first: {
          type: 'tab',
          fields: { name: { type: 'text', required: true, minLength: 5 } }
        },
        second: {
          type: 'tab',
          fields: {
            name: { type: 'text', required: true, pattern: '^[a-z]+$' }
          }
        }
      }
    })
    expect(
      getDataValidationErrors(form, { name: 'AB' }, { services })
    ).toEqual({
      name: [
        { message: 'must be at least 5 characters long' },
        { message: 'must match pattern "^[a-z]+$"' }
      ]
    })
    // Messages of several fields appear once:
    expect(getDataValidationErrors(form, { name: '' }, { services })).toEqual({
      name: [
        { message: 'must be at least 5 characters long' },
        { message: 'is required' }
      ]
    })
  })

  it('skips the checks of hidden fields of the same value', async () => {
    const form = await createForm({
      tabs: {
        first: {
          type: 'tab',
          if: false,
          fields: { name: { type: 'text', required: true } }
        },
        second: { type: 'tab', fields: { name: { type: 'text' } } }
      }
    })
    expect(getDataValidationErrors(form, { name: '' }, { services })).toBe(
      null
    )
  })

  it('skips nested sections whose fields are all hidden', async () => {
    const createAddressForm = isStreetShown =>
      createForm({
        fields: {
          address: {
            type: 'section',
            nested: true,
            validate: () => 'is invalid',
            fields: { street: { type: 'text', if: isStreetShown } }
          }
        }
      })
    const data = { address: { street: 'Main Street' } }
    expect(
      getDataValidationErrors(await createAddressForm(false), data, {
        services
      })
    ).toBe(null)
    expect(
      getDataValidationErrors(await createAddressForm(true), data, {
        services
      })
    ).toEqual({ address: [{ message: 'is invalid' }] })
  })

  it('walks the forms of `fields()` callbacks as set up', async () => {
    // The defaults nest the section, once the created form is set up:
    const api = { defaults: { section: { nested: true } } }
    const services = { adminContext: { api } }
    const form = await setupForm(api, {
      type: 'form',
      fields: {
        items: {
          type: 'list',
          inlined: true,
          form: {
            type: 'form',
            fields: () => ({
              address: {
                type: 'section',
                fields: { street: { type: 'text', required: true } }
              }
            })
          }
        }
      }
    })
    const data = { items: [{ street: 'Main Street', address: { street: '' } }] }
    getDataValidationErrors(form, data, { services })
    await flushPromises()
    expect(getDataValidationErrors(form, data, { services })).toEqual({
      'items/0/address/street': [{ message: 'is required' }]
    })
  })
})

describe('initializeData()', () => {
  it('sets the defaults of all missing values', async () => {
    const form = await createForm(catalogueForm)
    const data = initializeData(form, createCatalogue(), services)
    const [books, records] = data.collections
    expect(books.items[0].chapters).toEqual([
      { title: 'x'.repeat(30), length: 1 },
      { title: 'Two', length: 1 }
    ])
    expect(books.items[1]).toEqual({
      type: 'book',
      name: 'Long',
      pages: 200,
      onSale: false,
      price: null,
      chapters: [],
      tags: [],
      summary: ''
    })
    expect(records).toEqual({
      name: '',
      code: '',
      discount: null,
      currency: null,
      items: [
        {
          type: 'record',
          name: 'Record',
          email: 'nope',
          format: 'lp',
          tracks: []
        }
      ]
    })
    // Passwords keep their missing value, sources with their own resource get
    // the defaults of their items unless they're skipped:
    expect('secret' in data).toBe(false)
    expect(data.vendors).toEqual([{ name: '' }])
    const skipped = initializeData(form, createCatalogue(), services, {
      shouldSkipSourcesWithResource: true
    })
    expect(skipped.vendors).toEqual([{}])
  })

  it('leaves items without a form as they are', async () => {
    const form = await createForm(catalogueForm)
    const data = createCatalogue()
    data.collections[0].items.push({ type: 'unknown' })
    initializeData(form, data, services)
    expect(data.collections[0].items[2]).toEqual({ type: 'unknown' })
  })

  it('takes the default of the first field of the same value', async () => {
    const form = await createForm({
      tabs: {
        first: { type: 'tab', fields: { format: { type: 'text' } } },
        second: {
          type: 'tab',
          fields: { format: { type: 'text', default: 'lp' } }
        }
      }
    })
    expect(initializeData(form, {}, services)).toEqual({ format: 'lp' })
  })
})

describe('deserializeData()', () => {
  it('converts the values of all fields', async () => {
    const dataPaths = []
    const form = await createForm(
      addHook(catalogueForm, 'deserializeValue', ({ value, dataPath }) => {
        dataPaths.push(dataPath)
        return value
      })
    )
    deserializeData(form, createCatalogue(), { services, dataPath: '' })
    // Missing values keep their defaults, sources with their own resource
    // convert their items too:
    expect(dataPaths).toEqual([
      'title',
      'showPrices',
      'collections',
      'collections/0/name',
      'collections/0/code',
      'collections/0/discount',
      'collections/0/currency',
      'collections/0/items',
      'collections/0/items/0/name',
      'collections/0/items/0/pages',
      'collections/0/items/0/onSale',
      'collections/0/items/0/price',
      'collections/0/items/0/chapters',
      'collections/0/items/0/chapters/0/title',
      'collections/0/items/0/chapters/1/title',
      'collections/0/items/0/tags',
      'collections/0/items/0/tags/0',
      'collections/0/items/0/tags/1',
      'collections/0/items/0/blurb',
      'collections/0/items/1/name',
      'collections/0/items/1/pages',
      'collections/0/items/1/onSale',
      'collections/0/items/1/chapters',
      'collections/0/items/1/tags',
      'collections/1/name',
      'collections/1/items',
      'collections/1/items/0/name',
      'collections/1/items/0/email',
      'collections/1/items/0/tracks',
      'summaryNote',
      'vendors',
      'notes'
    ])
  })

  it('converts the values of the children of trees', async () => {
    const pageForm = {
      type: 'form',
      fields: {
        title: { type: 'text', deserializeValue: ({ value }) => value.trim() }
      }
    }
    const form = await createForm({
      fields: {
        pages: {
          type: 'tree-list',
          form: pageForm,
          children: { name: 'subpages', form: pageForm }
        }
      }
    })
    const data = {
      pages: [
        {
          title: ' About ',
          subpages: [{ title: ' Team ' }, { title: ' History ' }]
        }
      ]
    }
    deserializeData(form, data, { services })
    expect(data).toEqual({
      pages: [
        {
          title: 'About',
          subpages: [{ title: 'Team' }, { title: 'History' }]
        }
      ]
    })
  })

  it('converts with the first field of the same value', async () => {
    const form = await createForm({
      tabs: {
        first: {
          type: 'tab',
          fields: {
            title: { type: 'text' },
            name: { type: 'text', deserializeValue: ({ value }) => `${value}1` }
          }
        },
        second: {
          type: 'tab',
          fields: {
            title: {
              type: 'text',
              deserializeValue: ({ value }) => `${value}2`
            },
            name: { type: 'text', deserializeValue: ({ value }) => `${value}2` }
          }
        }
      }
    })
    const data = { title: 'Title', name: 'Name' }
    deserializeData(form, data, { services })
    expect(data).toEqual({ title: 'Title2', name: 'Name1' })
  })
})

describe('mergeData()', () => {
  it('merges the data in place, matching the items by their ids', async () => {
    const form = await createForm(catalogueForm)
    const target = createCatalogue()
    target.collections.forEach((collection, index) => {
      collection.id = index + 1
      collection.items.forEach((item, itemIndex) => {
        item.id = `${index}-${itemIndex}`
      })
    })
    const source = structuredClone(target)
    source.collections.reverse()
    const [records, books] = source.collections
    books.items[0].name = 'Merged'
    books.items[0].chapters.push({ title: 'Three' })
    books.items[0].tags = ['b']
    // Items whose type changed are replaced:
    books.items[1] = { id: '0-1', type: 'record', name: 'Record', tracks: [] }
    records.items.push({ type: 'record', name: 'Added', tracks: [] })
    source.vendors = [{ name: 'Vendor' }]
    const { collections, vendors } = target
    const [targetBooks, targetRecords] = collections
    const [book, longBook] = targetBooks.items
    const { chapters, tags } = book
    const [chapter] = chapters
    const [record] = targetRecords.items
    const result = mergeData(form, target, source, {
      services,
      shouldKeepSourcesWithResource: true
    })
    expect(result).toBe(target)
    expect(target).toEqual({ ...source, vendors: [{}] })
    expect(target.collections).toBe(collections)
    expect(collections[0]).toBe(targetRecords)
    expect(collections[1]).toBe(targetBooks)
    expect(targetBooks.items[0]).toBe(book)
    expect(targetBooks.items[1]).not.toBe(longBook)
    expect(book.chapters).toBe(chapters)
    expect(chapters[0]).toBe(chapter)
    expect(book.tags).toBe(tags)
    expect(targetRecords.items[0]).toBe(record)
    expect(target.vendors).toBe(vendors)
  })

  it('merges the children of trees in place', async () => {
    const pageForm = { type: 'form', fields: { title: { type: 'text' } } }
    const form = await createForm({
      fields: {
        pages: {
          type: 'tree-list',
          form: pageForm,
          children: { name: 'subpages', form: pageForm }
        }
      }
    })
    const target = {
      pages: [
        {
          id: 1,
          title: 'About',
          subpages: [
            { id: 2, title: 'Team' },
            { id: 3, title: 'History' }
          ]
        }
      ]
    }
    const [about] = target.pages
    const [team, history] = about.subpages
    mergeData(
      form,
      target,
      {
        pages: [
          {
            id: 1,
            title: 'About us',
            subpages: [
              { id: 3, title: 'Our history' },
              { id: 2, title: 'Team' }
            ]
          }
        ]
      },
      { services }
    )
    expect(target.pages[0]).toBe(about)
    expect(about.subpages).toEqual([history, team])
    expect(about.subpages[0]).toBe(history)
    expect(history.title).toBe('Our history')
    expect(about.title).toBe('About us')
  })

  it('merges with the first field of the same value that has a form', async () => {
    const noteForm = { type: 'form', fields: { text: { type: 'text' } } }
    const form = await createForm({
      tabs: {
        first: {
          type: 'tab',
          fields: {
            entries: {
              type: 'list',
              form: { type: 'form', fields: { title: { type: 'text' } } }
            },
            notes: { type: 'text' }
          }
        },
        second: {
          type: 'tab',
          fields: {
            entries: {
              type: 'list',
              form: {
                type: 'form',
                fields: {
                  title: { type: 'text' },
                  notes: { type: 'list', form: noteForm }
                }
              }
            },
            notes: { type: 'list', form: noteForm }
          }
        }
      }
    })
    const target = {
      entries: [{ id: 1, title: 'One', notes: [{ id: 1, text: 'A' }] }],
      notes: [{ id: 1, text: 'B' }]
    }
    const [entry] = target.entries
    const [entryNote] = entry.notes
    const [note] = target.notes
    mergeData(
      form,
      target,
      {
        entries: [{ id: 1, title: 'Uno', notes: [{ id: 1, text: 'a' }] }],
        notes: [{ id: 1, text: 'b' }]
      },
      { services }
    )
    expect(target.entries[0]).toBe(entry)
    expect(entry.notes[0]).toBe(entryNote)
    expect(target.notes[0]).toBe(note)
    expect(target).toEqual({
      entries: [{ id: 1, title: 'Uno', notes: [{ id: 1, text: 'a' }] }],
      notes: [{ id: 1, text: 'b' }]
    })
  })
})

describe('serializeData()', () => {
  it('serializes the values of all fields', async () => {
    const form = await createForm(catalogueForm)
    expect(
      serializeData(form, null, createCatalogue(), '', { services })
    ).toEqual(serializedCatalogue)
  })

  it('serializes the values after the values of their items', async () => {
    const dataPaths = []
    const form = await createForm(
      addHook(catalogueForm, 'serializeValue', ({ value, dataPath }) => {
        dataPaths.push(dataPath)
        return value
      })
    )
    serializeData(form, null, createCatalogue(), '', { services })
    // Values get defaults, and sources with their own resource and passwords
    // are serialized before they're excluded:
    expect(dataPaths).toEqual([
      'title',
      'showPrices',
      'secret',
      'collections/0/name',
      'collections/0/code',
      'collections/0/discount',
      'collections/0/currency',
      'collections/0/items/0/name',
      'collections/0/items/0/pages',
      'collections/0/items/0/onSale',
      'collections/0/items/0/price',
      'collections/0/items/0/chapters/0/title',
      'collections/0/items/0/chapters/0/length',
      'collections/0/items/0/chapters/1/title',
      'collections/0/items/0/chapters/1/length',
      'collections/0/items/0/chapters',
      'collections/0/items/0/tags/0',
      'collections/0/items/0/tags/1',
      'collections/0/items/0/tags',
      'collections/0/items/0/blurb',
      'collections/0/items/1/name',
      'collections/0/items/1/pages',
      'collections/0/items/1/onSale',
      'collections/0/items/1/price',
      'collections/0/items/1/chapters',
      'collections/0/items/1/tags',
      'collections/0/items/1/summary',
      'collections/0/items',
      'collections/1/name',
      'collections/1/code',
      'collections/1/discount',
      'collections/1/currency',
      'collections/1/items/0/name',
      'collections/1/items/0/email',
      'collections/1/items/0/format',
      'collections/1/items/0/tracks',
      'collections/1/items',
      'collections',
      'summaryNote',
      'vendors/0/name',
      'vendors',
      'notes'
    ])
  })

  it('serializes the children of trees', async () => {
    const pageForm = {
      type: 'form',
      fields: {
        title: { type: 'text', serializeValue: ({ value }) => value.trim() }
      }
    }
    const form = await createForm({
      fields: {
        pages: {
          type: 'tree-list',
          form: pageForm,
          children: { name: 'subpages', form: pageForm }
        }
      }
    })
    const data = {
      pages: [
        {
          id: 1,
          title: ' About ',
          draft: true,
          subpages: [{ id: 2, title: ' Team ', draft: true }]
        }
      ]
    }
    expect(serializeData(form, null, data, '', { services })).toEqual({
      pages: [{ id: 1, title: 'About', subpages: [{ id: 2, title: 'Team' }] }]
    })
  })

  it('serializes with the first field of the same value', async () => {
    const form = await createForm({
      tabs: {
        first: {
          type: 'tab',
          fields: {
            title: { type: 'text' },
            name: { type: 'text', serializeValue: ({ value }) => `${value}1` }
          }
        },
        second: {
          type: 'tab',
          fields: {
            title: { type: 'text', serializeValue: ({ value }) => `${value}2` },
            name: { type: 'text', serializeValue: ({ value }) => `${value}2` }
          }
        }
      }
    })
    const data = { title: 'Title', name: 'Name' }
    expect(serializeData(form, null, data, '', { services })).toEqual({
      title: 'Title2',
      name: 'Name1'
    })
  })

  it('excludes with the first field of the same value', async () => {
    const form = await createForm({
      tabs: {
        first: {
          type: 'tab',
          fields: {
            notes: { type: 'text', serializeValue: ({ value }) => `${value}1` },
            title: { type: 'text', exclude: true }
          }
        },
        second: {
          type: 'tab',
          fields: {
            notes: { type: 'text', exclude: true },
            title: { type: 'text', serializeValue: ({ value }) => `${value}2` }
          }
        }
      }
    })
    const data = { notes: 'Notes', title: 'Title' }
    expect(serializeData(form, null, data, '', { services })).toEqual({})
  })

  it('serializes the items of the same value with all their forms', async () => {
    const form = await createForm({
      tabs: {
        first: {
          type: 'tab',
          fields: {
            entries: {
              type: 'list',
              form: { type: 'form', fields: { title: { type: 'text' } } }
            }
          }
        },
        second: {
          type: 'tab',
          fields: {
            entries: {
              type: 'list',
              form: { type: 'form', fields: { notes: { type: 'text' } } }
            }
          }
        }
      }
    })
    const data = { entries: [{ id: 1, title: 'One', notes: 'A', other: 1 }] }
    expect(serializeData(form, null, data, '', { services })).toEqual({
      entries: [{ id: 1, title: 'One', notes: 'A' }]
    })
  })
})

describe('clipboard', () => {
  const createCopy = async (form, data) =>
    toClipboard(form, { type: 'list', form }, data, '', {
      services,
      rootData: data
    })

  it('copies and pastes the data', async () => {
    const form = await createForm(catalogueForm)
    const copy = await createCopy(form, createCatalogue())
    const { data, unresolvedLabels } = await fromClipboard(form, copy, {
      services
    })
    expect(unresolvedLabels).toEqual([])
    expect(data).toEqual(serializedCatalogue)
  })

  it('copies and pastes the children of trees', async () => {
    const pageForm = { type: 'form', fields: { title: { type: 'text' } } }
    const form = await createForm({
      fields: {
        pages: {
          type: 'tree-list',
          form: pageForm,
          children: { name: 'subpages', form: pageForm }
        }
      }
    })
    const copy = await createCopy(form, {
      pages: [{ id: 1, title: 'About', subpages: [{ id: 2, title: 'Team' }] }]
    })
    const { data } = await fromClipboard(form, copy, { services })
    expect(data).toEqual({
      pages: [{ title: 'About', subpages: [{ title: 'Team' }] }]
    })
  })

  it('finds the upload fields', async () => {
    const upload = { type: 'upload' }
    const pageForm = {
      type: 'form',
      fields: { image: upload, files: { ...upload, multiple: true } }
    }
    const form = await createForm({
      fields: {
        pages: {
          type: 'tree-list',
          form: pageForm,
          children: { name: 'subpages', form: pageForm }
        }
      },
      tabs: {
        first: { type: 'tab', fields: { cover: upload } },
        second: { type: 'tab', fields: { cover: upload } }
      }
    })
    const data = {
      cover: null,
      pages: [{ image: null, subpages: [{ image: null, files: [] }] }]
    }
    const entries = getUploadEntries(form, data, {
      dataPath: '',
      services,
      rootData: data
    })
    expect(entries.map(({ dataPath }) => dataPath)).toEqual([
      'pages/0/image',
      'pages/0/files',
      'pages/0/subpages/0/image',
      'pages/0/subpages/0/files',
      'cover',
      'cover'
    ])
  })
})

describe('isDataPathExcluded()', () => {
  it('tells which values are left out of the data that is sent', async () => {
    const form = await createForm(catalogueForm)
    const data = createCatalogue()
    const dataPaths = [
      'title',
      'secret',
      'unknown',
      'collections',
      'collections/0',
      'collections/0/discount',
      'collections/0/items/0/tags/1',
      'collections/0/items/0/chapters/0/title',
      'collections/0/items/0/chapters/0/title/x',
      'collections/1/items/0/tracks',
      'vendors',
      'vendors/0',
      'vendors/0/name',
      'summaryNote',
      'notes'
    ]
    expect(
      dataPaths.filter(dataPath =>
        isDataPathExcluded(form, data, dataPath, { services })
      )
    ).toEqual(['unknown', 'summaryNote'])
  })

  it('tells which values in the children of trees are left out', async () => {
    const pageForm = {
      type: 'form',
      fields: {
        title: { type: 'text' },
        draft: { type: 'switch', exclude: true }
      }
    }
    const form = await createForm({
      fields: {
        pages: {
          type: 'tree-list',
          form: pageForm,
          children: { name: 'subpages', form: pageForm }
        }
      }
    })
    const data = {
      pages: [{ title: 'About', subpages: [{ title: 'Team', draft: true }] }]
    }
    const dataPaths = [
      'pages/0/title',
      'pages/0/subpages/0',
      'pages/0/subpages/0/title',
      'pages/0/subpages/0/draft'
    ]
    expect(
      dataPaths.filter(dataPath =>
        isDataPathExcluded(form, data, dataPath, { services })
      )
    ).toEqual(['pages/0/subpages/0/draft'])
  })

  it('takes the exclusion of the first field of the same value', async () => {
    const form = await createForm({
      tabs: {
        first: {
          type: 'tab',
          fields: { notes: { type: 'text' }, title: { type: 'text' } }
        },
        second: {
          type: 'tab',
          fields: {
            notes: { type: 'text', exclude: true },
            title: { type: 'text', exclude: false }
          }
        }
      }
    })
    const data = { notes: 'Notes', title: 'Title' }
    expect(isDataPathExcluded(form, data, 'notes', { services })).toBe(true)
    expect(isDataPathExcluded(form, data, 'title', { services })).toBe(false)
  })
})

describe('getItemDisplayValue()', () => {
  // A type that displays its values differently from how they're stored:
  defineType({
    type: 'status',
    component: {},
    getDisplayValue: ({ value }) => value.toUpperCase()
  })
  const status = { type: 'status' }
  const getDisplayValues = (sourceSchema, item, names) => {
    const context = new SchemaContext(services, {
      schema: sourceSchema,
      data: item,
      dataPath: '',
      rootData: item
    })
    return names.map(name =>
      getItemDisplayValue(sourceSchema, item, name, {
        services,
        dataPath: '',
        context
      })
    )
  }

  it('displays the values of the fields of items', async () => {
    const form = await createForm(catalogueForm)
    const { items } = form.fields.collections.form.fields
    const [books, records] = createCatalogue().collections
    expect(
      getDisplayValues(items, books.items[0], [
        'name',
        'pages',
        'onSale',
        'chapters',
        'blurb',
        'unknown'
      ])
    ).toEqual([
      '',
      0,
      true,
      [{ title: 'x'.repeat(30) }, { title: 'Two' }],
      'Much too long',
      undefined
    ])
    expect(
      getDisplayValues(items, records.items[0], ['email', 'format', 'tracks'])
    ).toEqual(['nope', undefined, []])
  })

  it('displays the values of the children of trees', async () => {
    const pageForm = {
      type: 'form',
      fields: { status, title: { type: 'text' } }
    }
    const form = await createForm({
      fields: {
        pages: {
          type: 'tree-list',
          form: pageForm,
          children: { name: 'subpages', form: pageForm }
        }
      }
    })
    const { children } = form.fields.pages
    expect(
      getDisplayValues(
        children,
        { title: 'Team', status: 'live' },
        ['title', 'status']
      )
    ).toEqual(['Team', 'LIVE'])
  })

  it('displays with the first field of the same value', async () => {
    const form = await createForm({
      fields: {
        entries: {
          type: 'list',
          form: {
            type: 'form',
            tabs: {
              first: {
                type: 'tab',
                fields: { status: { type: 'text' } }
              },
              second: {
                type: 'tab',
                fields: { status }
              }
            }
          }
        }
      }
    })
    expect(
      getDisplayValues(
        form.fields.entries,
        { status: 'live' },
        ['status']
      )
    ).toEqual(['live'])
  })
})

describe('DataModel', () => {
  async function createDataModel(form, data) {
    const schema = await createForm(form)
    const dataModel = new DataModel({
      schema: () => schema,
      data: reactive(data),
      services
    })
    return { dataModel, data: dataModel.data }
  }

  // The data paths of the records, and the fields that they're for:
  const getRecords = dataModel =>
    [...dataModel.componentRecords.values()].map(({ dataPath, entry }) => [
      dataPath.value,
      entry.schema
    ])

  it('records the fields with options', async () => {
    const { dataModel, data } = await createDataModel(
      catalogueForm,
      createCatalogue()
    )
    const { collections } = catalogueForm.fields
    const { currency } = collections.form.fields.pricing.fields
    const { format } = collections.form.fields.items.forms.record.fields
    expect(getRecords(dataModel)).toEqual([
      ['collections/0/currency', currency],
      ['collections/1/currency', currency],
      ['collections/1/items/0/format', format]
    ])
    // Hidden fields have no records:
    data.showPrices = false
    await nextTick()
    expect(getRecords(dataModel)).toEqual([
      ['collections/1/items/0/format', format]
    ])
    dataModel.stop()
  })

  it('sets the defaults of values that go missing later', async () => {
    const { dataModel, data } = await createDataModel(
      catalogueForm,
      createCatalogue()
    )
    const [books, records] = data.collections
    delete books.items[0].chapters[1].length
    delete data.notes
    records.items.push({ type: 'record', name: 'New' })
    books.items[0].tags.push('')
    // Sources with their own resource keep their data:
    data.vendors.push({})
    await nextTick()
    expect(books.items[0].chapters[1]).toEqual({ title: 'Two', length: 1 })
    expect(data.notes).toBe('')
    expect(records.items[1]).toEqual({
      type: 'record',
      name: 'New',
      email: '',
      format: 'lp',
      tracks: []
    })
    expect(books.items[0].tags).toEqual(['a', '', ''])
    expect(data.vendors).toEqual([{}, {}])
    dataModel.stop()
  })

  it('marks the edits inside sources with their own resource', async () => {
    const { dataModel, data } = await createDataModel(
      catalogueForm,
      createCatalogue()
    )
    dataModel.set(
      { data: data.vendors[0], name: 'name', dataPath: 'vendors/0/name' },
      'Vendor'
    )
    expect(dataModel.isEdited).toBe(true)
    dataModel.markClean({ dataPath: 'vendors' })
    expect(dataModel.isEdited).toBe(false)
    dataModel.set({ data, name: 'title', dataPath: 'title' }, 'Catalogue')
    dataModel.markClean({ dataPath: 'vendors' })
    expect(dataModel.isEdited).toBe(true)
    dataModel.stop()
  })

  it('computes and sets defaults in the children of trees', async () => {
    const pageForm = {
      type: 'form',
      fields: {
        title: { type: 'text' },
        slug: {
          type: 'text',
          computeValue: ({ item }) => item.title.toLowerCase()
        },
        status: { type: 'text', default: 'draft' }
      }
    }
    const { dataModel, data } = await createDataModel(
      {
        fields: {
          pages: {
            type: 'tree-list',
            form: pageForm,
            children: { name: 'subpages', form: pageForm }
          }
        }
      },
      {
        pages: [
          {
            title: 'About',
            status: 'live',
            subpages: [{ title: 'Team', status: 'live' }]
          }
        ]
      }
    )
    const [about] = data.pages
    expect(getRecords(dataModel)).toEqual([
      ['pages/0/slug', pageForm.fields.slug],
      ['pages/0/subpages/0/slug', pageForm.fields.slug]
    ])
    about.subpages.push({ title: 'History' })
    await nextTick()
    expect(about.subpages[1]).toEqual({
      title: 'History',
      slug: 'history',
      status: 'draft'
    })
    expect(getRecords(dataModel).map(([dataPath]) => dataPath)).toEqual([
      'pages/0/slug',
      'pages/0/subpages/0/slug',
      'pages/0/subpages/1/slug'
    ])
    dataModel.stop()
  })

  it('takes the compute and default of the first field of the same value', async () => {
    const status = { type: 'text' }
    const statusWithDefault = { type: 'text', default: 'draft' }
    const itemForm = {
      type: 'form',
      tabs: {
        first: { type: 'tab', fields: { status } },
        second: { type: 'tab', fields: { status: statusWithDefault } }
      }
    }
    const { dataModel, data } = await createDataModel(
      {
        tabs: {
          first: {
            type: 'tab',
            fields: {
              label: { type: 'text', computeValue: () => 'first' },
              status
            }
          },
          second: {
            type: 'tab',
            fields: {
              label: { type: 'text', computeValue: () => 'second' },
              status: statusWithDefault,
              entries: {
                type: 'list',
                computeValue: () => [{}],
                form: itemForm
              }
            }
          }
        }
      },
      { status: 'live' }
    )
    expect(data.label).toBe('first')
    // Computed items get the same defaults as values that go missing:
    expect(data.entries).toEqual([{ status: 'draft' }])
    delete data.status
    await nextTick()
    expect(data.status).toBe('draft')
    dataModel.stop()
  })

  describe('errors', () => {
    it('gives the errors to the fields that display them', async () => {
      const { dataModel } = await createDataModel(
        catalogueForm,
        createCatalogue()
      )
      const errors = getDataValidationErrors(
        dataModel.schema,
        dataModel.data,
        { services, dataPath: '' }
      )
      expect(
        dataModel.replaceErrors({
          ...errors,
          'collections/0/items/0/chapters/0/title/x': [{ message: 'deep' }],
          'unknown': [{ message: 'unknown' }]
        })
      ).toEqual({ unknown: [{ message: 'unknown' }] })
      expect(dataModel.getErrorDataPaths()).toEqual([
        'title',
        'collections/0/code',
        'collections/0/discount',
        'collections/0/currency',
        'collections/0/items/0/name',
        'collections/0/items/0/pages',
        'collections/0/items/0/price',
        'collections/0/items/0/chapters/0/title',
        'collections/0/items/0/tags/1',
        'collections/0/items/0/blurb',
        'collections/0/items/1/summary',
        'collections/1/name',
        'collections/1/items/0/email',
        'collections/1/items/0/tracks',
        'summaryNote',
        'notes'
      ])
      expect(
        dataModel.getErrors('collections/0/items/0/chapters/0/title')
      ).toEqual([
        { message: 'must be at most 20 characters long' },
        { message: 'deep', path: 'x' }
      ])
      dataModel.clearErrors('collections/0')
      expect(dataModel.getErrorDataPaths()).toEqual([
        'title',
        'collections/1/name',
        'collections/1/items/0/email',
        'collections/1/items/0/tracks',
        'summaryNote',
        'notes'
      ])
      dataModel.stop()
    })

    it('gives the errors to the fields in the children of trees', async () => {
      const pageForm = {
        type: 'form',
        fields: { title: { type: 'text', required: true } }
      }
      const { dataModel } = await createDataModel(
        {
          fields: {
            pages: {
              type: 'tree-list',
              form: pageForm,
              children: { name: 'subpages', form: pageForm }
            }
          }
        },
        { pages: [{ title: 'About', subpages: [{ title: '' }] }] }
      )
      dataModel.replaceErrors({
        'pages/0/subpages/0/title': [{ message: 'is required' }]
      })
      expect(dataModel.getErrorDataPaths()).toEqual([
        'pages/0/subpages/0/title'
      ])
      dataModel.stop()
    })

    it('gives the errors to all fields of the same value', async () => {
      const { dataModel } = await createDataModel(
        {
          tabs: {
            first: { type: 'tab', fields: { name: { type: 'text' } } },
            second: { type: 'tab', fields: { name: { type: 'text' } } }
          }
        },
        { name: '' }
      )
      dataModel.replaceErrors({ name: [{ message: 'is required' }] })
      expect(dataModel.getErrorDataPaths()).toEqual(['name', 'name'])
      expect(dataModel.getErrors('name')).toEqual([{ message: 'is required' }])
      dataModel.clearErrors()
      expect(dataModel.getErrorDataPaths()).toEqual([])
      dataModel.stop()
    })
  })
})
