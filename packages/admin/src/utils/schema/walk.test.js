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
  getItemDisplayValue,
  getDataValidationErrors
} from './data.js'
import { walkData } from './walk.js'
import { DataModel } from '../DataModel.ts'
import { mergeData } from '../mergeData.ts'
import { fromClipboard } from '../fromClipboard.ts'
import { toClipboard } from '../toClipboard.ts'
import { getUploadEntries } from '../interchange.ts'
import {
  showPrices,
  catalogueForm,
  createCatalogue,
  catalogueErrors,
  serializedCatalogue
} from './catalogue.fixture.js'

// The API settings that setting up forms reads, also the forms of `fields()`
// callbacks, which the services hand out:
const api = { defaults: {} }
const services = { adminContext: { api } }

async function createForm(form) {
  return setupForm(api, { type: 'form', ...form })
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

describe('walkData()', () => {
  it('walks the items of the values that `shouldWalk()` accepts', async () => {
    const form = await createForm(catalogueForm)
    const dataPaths = []
    walkData(form, createCatalogue(), {
      dataPath: '',
      services,
      shouldWalk: ({ dataPath }) => dataPath !== 'collections',
      visit: ({ dataPath }) => dataPaths.push(dataPath)
    })
    expect(dataPaths).toEqual([
      'title',
      'showPrices',
      'secret',
      'collections',
      'summaryNote',
      'vendors',
      'vendors/0/name',
      'notes'
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
        { message: 'is required' },
        { message: 'must be at least 5 characters long' }
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

  it('runs the checks of invisible fields of the same value', async () => {
    const form = await createForm({
      tabs: {
        first: {
          type: 'tab',
          fields: { name: { type: 'text', required: true, visible: false } }
        },
        second: { type: 'tab', fields: { name: { type: 'text' } } }
      }
    })
    expect(getDataValidationErrors(form, { name: '' }, { services })).toEqual({
      name: [{ message: 'is required' }]
    })
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

  it('validates the fields whose `if` fails, and logs the error', async () => {
    const error = new Error('Unable to tell')
    // Silence the logged error, which the test checks:
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const form = await createForm({
      fields: {
        name: {
          type: 'text',
          required: true,
          if: () => {
            throw error
          }
        }
      }
    })
    expect(getDataValidationErrors(form, { name: '' }, { services })).toEqual({
      name: [{ message: 'is required' }]
    })
    expect(logError).toHaveBeenCalledWith(error)
    logError.mockRestore()
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
      summary: null
    })
    expect(records).toEqual({
      name: '',
      code: null,
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
    expect(data.vendors).toEqual([{ name: null }])
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

  it('sets the defaults before `if` callbacks read them', async () => {
    const form = await createForm({
      fields: {
        note: {
          type: 'text',
          default: 'new',
          if: ({ item }) => item.status === 'draft'
        },
        downloads: {
          type: 'list',
          if: ({ item }) => item.downloads.length > 0,
          form: { type: 'form', fields: { url: { type: 'text' } } }
        },
        status: { type: 'text', default: 'draft' }
      }
    })
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(initializeData(form, {}, services)).toEqual({
      note: 'new',
      downloads: [],
      status: 'draft'
    })
    expect(logError).not.toHaveBeenCalled()
    logError.mockRestore()
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

  it('stores the empty values of options with `nullable: false`', async () => {
    const form = await createForm({
      fields: {
        format: { type: 'select', options: ['lp', 'cd'], nullable: false }
      }
    })
    expect(initializeData(form, {}, services)).toEqual({ format: '' })
  })

  it('starts objects with `nullable: false` empty', async () => {
    const form = await createForm({
      fields: {
        address: {
          type: 'object',
          nullable: false,
          form: { type: 'form', fields: { city: { type: 'text' } } }
        }
      }
    })
    expect(initializeData(form, {}, services)).toEqual({
      address: { city: null }
    })
  })
})

describe('initializeData() of several fields of the same value', () => {
  const createStatusForm = settings =>
    createForm({
      tabs: {
        first: {
          type: 'tab',
          fields: { status: { type: 'text', default: 'draft', ...settings } }
        },
        second: { type: 'tab', fields: { status: { type: 'text' } } }
      }
    })

  it('sets the defaults of hidden and invisible fields', async () => {
    for (const settings of [{ if: false }, { visible: false }]) {
      const form = await createStatusForm(settings)
      expect(initializeData(form, {}, services)).toEqual({ status: 'draft' })
    }
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

  it('leaves out the values of hidden fields', async () => {
    const form = await createForm(catalogueForm)
    const data = { ...createCatalogue(), showPrices: false }
    const [books, records] = serializeData(form, null, data, '', {
      services
    }).collections
    expect(books).not.toHaveProperty('discount')
    expect(books).not.toHaveProperty('currency')
    expect(books.items[0]).not.toHaveProperty('price')
    expect(records).not.toHaveProperty('discount')
    expect(books.name).toBe('Books')
  })

  it('serializes with the shown fields of the same value', async () => {
    const createStatusForm = settings =>
      createForm({
        tabs: {
          first: {
            type: 'tab',
            fields: {
              status: {
                type: 'text',
                serializeValue: ({ value }) => value.toUpperCase(),
                ...settings
              }
            }
          },
          second: { type: 'tab', fields: { status: { type: 'text' } } }
        }
      })
    const data = { status: 'draft' }
    const serialize = async settings =>
      serializeData(await createStatusForm(settings), null, data, '', {
        services
      })
    expect(await serialize({ if: false })).toEqual({ status: 'draft' })
    expect(await serialize({ visible: false })).toEqual({ status: 'DRAFT' })
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

  it('passes the serialized value to `exclude()`', async () => {
    const form = await createForm({
      fields: {
        title: {
          type: 'text',
          serializeValue: ({ value }) => value.trim(),
          exclude: ({ value }) => value === ''
        },
        name: {
          type: 'text',
          serializeValue: ({ value }) => value.trim(),
          exclude: ({ value }) => value === ''
        }
      }
    })
    const data = { title: ' ', name: ' Name ' }
    expect(serializeData(form, null, data, '', { services })).toEqual({
      name: 'Name'
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

  it('copies only the values with fields, also in nested sections', async () => {
    const address = { type: 'form', fields: { city: { type: 'text' } } }
    const form = await createForm({
      fields: {
        home: { type: 'section', nested: true, fields: address.fields },
        office: { type: 'object', form: address }
      }
    })
    const copy = await createCopy(form, {
      home: { id: 1, city: 'Basel' },
      office: { id: 2, city: 'Zurich' }
    })
    expect(copy).toEqual({
      home: { city: 'Basel' },
      office: { city: 'Zurich' }
    })
  })

  it('finds the values with files, once per value', async () => {
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
      'cover'
    ])
  })

  it('finds the limits of the files, also of callbacks', async () => {
    const form = await createForm({
      fields: {
        image: { type: 'upload', extensions: 'png,jpg', maxSize: 1000 },
        files: {
          type: 'upload',
          multiple: true,
          maxSize: ({ item }) => item.maxSize
        }
      }
    })
    const data = { image: null, files: [], maxSize: '2kB' }
    const entries = getUploadEntries(form, data, {
      dataPath: '',
      services,
      rootData: data
    })
    expect(entries.map(({ limits }) => limits)).toEqual([
      { extensions: 'png,jpg', maxSize: 1000 },
      { extensions: undefined, maxSize: 2000 }
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
    ).toEqual(['unknown'])
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

  it('displays only the values of the item itself', async () => {
    const form = await createForm({
      fields: {
        entries: {
          type: 'list',
          form: {
            type: 'form',
            fields: {
              meta: {
                type: 'section',
                nested: true,
                fields: { status }
              },
              status: { type: 'text' }
            }
          }
        }
      }
    })
    expect(
      getDisplayValues(
        form.fields.entries,
        { meta: { status: 'live' }, status: 'draft' },
        ['status']
      )
    ).toEqual(['draft'])
  })

  it('displays with the first shown field of the same value', async () => {
    const createEntries = async settings => {
      const form = await createForm({
        fields: {
          entries: {
            type: 'list',
            form: {
              type: 'form',
              tabs: {
                first: {
                  type: 'tab',
                  fields: { status: { ...status, ...settings } }
                },
                second: { type: 'tab', fields: { status: { type: 'text' } } }
              }
            }
          }
        }
      })
      return form.fields.entries
    }
    const getDisplayValue = async settings =>
      getDisplayValues(await createEntries(settings), { status: 'live' }, [
        'status'
      ])
    expect(await getDisplayValue({ if: false })).toEqual(['live'])
    expect(await getDisplayValue({ visible: false })).toEqual(['LIVE'])
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

  it('checks only the fields of the value and their containers', async () => {
    const calls = []
    const createIf = (name, value) => () => {
      calls.push(name)
      return value
    }
    const form = await createForm({
      fields: {
        entries: {
          type: 'list',
          form: {
            type: 'form',
            fields: {
              details: {
                type: 'section',
                if: createIf('details', false),
                fields: { status }
              },
              title: { type: 'text', if: createIf('title', true) }
            }
          }
        }
      }
    })
    expect(
      getDisplayValues(form.fields.entries, { status: 'live' }, ['status'])
    ).toEqual(['live'])
    expect(calls).toEqual(['details'])
  })

  it('displays wrapped primitives at the data path of the item', async () => {
    const dataPaths = []
    const form = await createForm({
      fields: {
        tags: {
          type: 'list',
          wrapPrimitives: 'tag',
          form: {
            type: 'form',
            fields: {
              tag: {
                type: 'text',
                if: ({ dataPath }) => dataPaths.push(dataPath) > 0
              }
            }
          }
        }
      }
    })
    const { tags } = form.fields
    const item = { tag: 'new' }
    const context = new SchemaContext(services, {
      schema: tags,
      data: item,
      dataPath: 'tags/0',
      rootData: item
    })
    expect(
      getItemDisplayValue(tags, item, 'tag', {
        services,
        dataPath: 'tags/0',
        context
      })
    ).toBe('new')
    expect(dataPaths).toEqual(['tags/0'])
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
    [...dataModel.fields.records.values()].map(
      ({ dataPath, entry }) => [dataPath.value, entry.schema]
    )

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
    expect(data.notes).toBe(null)
    expect(records.items[1]).toEqual({
      type: 'record',
      name: 'New',
      email: null,
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
      const fieldDataPaths = dataModel.errors.replace({
        ...errors,
        'collections/0/items/0/chapters/0/title/x': [{ message: 'deep' }],
        'unknown': [{ message: 'unknown' }]
      })
      expect(fieldDataPaths).toMatchObject({
        'collections/0/items/0/chapters/0/title/x':
          'collections/0/items/0/chapters/0/title'
      })
      expect(fieldDataPaths).not.toHaveProperty('unknown')
      expect(dataModel.errors.getDataPaths()).toEqual([
        'title',
        'collections/0/code',
        'collections/0/discount',
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
        dataModel.errors.get('collections/0/items/0/chapters/0/title')
      ).toEqual([
        { message: 'must be at most 20 characters long' },
        { message: 'deep', path: 'x' }
      ])
      dataModel.errors.clear('collections/0')
      expect(dataModel.errors.getDataPaths()).toEqual([
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
      dataModel.errors.replace({
        'pages/0/subpages/0/title': [{ message: 'is required' }]
      })
      expect(dataModel.errors.getDataPaths()).toEqual([
        'pages/0/subpages/0/title'
      ])
      dataModel.stop()
    })

    it('skips nested sections whose fields are all hidden', async () => {
      const { dataModel } = await createDataModel(
        {
          fields: {
            address: {
              type: 'section',
              nested: true,
              fields: { street: { type: 'text', if: false } }
            }
          }
        },
        { address: { street: '' } }
      )
      const errors = { address: [{ message: 'is invalid' }] }
      expect(dataModel.errors.replace(errors)).toEqual({})
      expect(dataModel.errors.getDataPaths()).toEqual([])
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
      dataModel.errors.replace({ name: [{ message: 'is required' }] })
      expect(dataModel.errors.getDataPaths()).toEqual(['name'])
      expect(dataModel.errors.get('name')).toEqual([{ message: 'is required' }])
      dataModel.errors.clear()
      expect(dataModel.errors.getDataPaths()).toEqual([])
      dataModel.stop()
    })
  })
})

describe('written properties', () => {
  // The catalogue as written properties, without what properties can't
  // describe: `fields()` callbacks (`details`) and sources with their own
  // resource (`vendors`). Strings are `nullable`, as the values of fields are:
  const text = { type: 'string', nullable: true }
  const catalogueProperties = {
    title: { ...text, required: true },
    showPrices: { type: 'boolean' },
    secret: { ...text, format: 'password' },
    collections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { ...text, required: true },
          code: { ...text, required: ({ item }) => item.items.length > 1 },
          discount: {
            type: 'number',
            nullable: true,
            if: showPrices,
            range: [0, 1]
          },
          currency: { ...text, if: showPrices, enum: ['EUR', 'USD'] },
          items: {
            type: 'array',
            forms: {
              book: {
                properties: {
                  name: { ...text, required: true },
                  pages: { type: 'integer', nullable: true, minimum: 1 },
                  onSale: { type: 'boolean' },
                  price: {
                    type: 'number',
                    nullable: true,
                    if: showPrices,
                    required: ({ item }) => item.onSale
                  },
                  chapters: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { ...text, required: true, maxLength: 20 },
                        length: { type: 'number', nullable: true, default: 1 }
                      }
                    }
                  },
                  tags: { type: 'array', items: { ...text, required: true } }
                }
              },
              record: {
                properties: {
                  name: { ...text, required: true },
                  email: { ...text, format: 'email' },
                  format: { ...text, enum: ['lp', 'cd'], default: 'lp' },
                  // Fields derive `minItems: 1` from `required`:
                  tracks: {
                    type: 'array',
                    minItems: 1,
                    items: {
                      type: 'object',
                      properties: {
                        title: { ...text, required: true },
                        seconds: { type: 'integer', nullable: true, minimum: 1 }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    summaryNote: { ...text, maxLength: 5 },
    notes: { ...text, maxLength: 5 }
  }
  const propertiesForm = { type: 'form', properties: catalogueProperties }

  // Leave out the values that only the fields describe:
  const withoutFieldsOnlyValues = ({ vendors, ...data }) => ({
    ...data,
    collections: data.collections.map(collection => ({
      ...collection,
      items: collection.items.map(({ blurb, summary, ...item }) => item)
    }))
  })

  it('validate like the fields that they describe', async () => {
    const {
      'collections/0/items/0/blurb': blurb,
      'collections/0/items/1/summary': summary,
      'collections/1/items/0/tracks': tracks,
      ...errors
    } = catalogueErrors
    expect(
      getDataValidationErrors(propertiesForm, createCatalogue(), { services })
    ).toEqual({
      ...errors,
      // Unlike static options, `enum` rejects other values:
      'collections/0/currency': [{ message: 'must be one of the options' }],
      'collections/1/items/0/tracks': [
        { message: 'must contain at least one item' }
      ]
    })
  })

  it('set the defaults of the fields that they describe', async () => {
    const form = await createForm(catalogueForm)
    const initialize = form =>
      withoutFieldsOnlyValues(initializeData(form, createCatalogue(), services))
    expect(initialize(propertiesForm)).toEqual(initialize(form))
  })

  it('serialize like the fields that they describe', async () => {
    expect(
      serializeData(propertiesForm, null, createCatalogue(), '', { services })
    ).toEqual(withoutFieldsOnlyValues({ ...serializedCatalogue, vendors: [] }))
  })
})
