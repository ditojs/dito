import { vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { flushPromises } from '@vue/test-utils'
// Importing the types defines them, so the walk sees their descriptors:
import '../../types/index.js'
import { setupForm } from './setup.js'
import { initializeData } from './data.js'
import { getDataValidationErrors } from './validation.js'
import { walkData } from './walk.js'
import { DataModel } from '../DataModel.ts'

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
})
