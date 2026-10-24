import { nextTick, reactive } from 'vue'
import SchemaContext from '../../SchemaContext.js'
// Importing the types defines them, so the walk sees their descriptors:
import '../../types/index.js'
import { setupForm } from './setup.js'
import {
  initializeData,
  deserializeData,
  serializeData,
  isDataPathExcluded,
  getItemDisplayValue,
  getDataValidationErrors
} from './data.js'
import { DataModel } from '../DataModel.ts'
import { mergeData } from '../mergeData.ts'
import {
  showPrices,
  catalogueForm,
  createCatalogue,
  catalogueErrors,
  serializedCatalogue
} from './catalogue.fixture.js'

// Today's results of the data operations, which the data core refactor keeps,
// except where marked. `walk.test.js` covers the catalogue itself.

// The API settings that setting up forms reads, and the formats of dates:
const api = {
  defaults: {},
  locale: 'en-US',
  formats: { date: { day: 'numeric', month: 'short', year: 'numeric' } }
}
const services = { adminContext: { api } }

const hidePrices = ({ rootItem }) => !rootItem.showPrices

// The catalogue with what the refactor has to translate into properties:
// fields of the same value in two tabs, alternative fields of the same value,
// computed, excluded, converted and edited values, `nullable: false`, and a
// nested section whose fields are all hidden:
const form = await setupForm(api, {
  type: 'form',
  ...catalogueForm,
  fields: {
    ...catalogueForm.fields,
    slug: {
      type: 'text',
      computeValue: ({ item }) => item.title?.toLowerCase() ?? null
    },
    importId: { type: 'text', exclude: true },
    published: { type: 'date' },
    nickname: { type: 'text', nullable: false },
    // Ratings are stored out of 10, and edited out of 5:
    rating: {
      type: 'number',
      maximum: 5,
      formatValue: ({ value }) => value / 2,
      parseValue: ({ value }) => value * 2
    },
    address: {
      type: 'section',
      nested: true,
      validate: () => 'is invalid',
      fields: { street: { type: 'text', if: hidePrices } }
    },
    offer: {
      type: 'section',
      if: showPrices,
      fields: { code: { type: 'text', maxLength: 4 } }
    },
    noOffer: {
      type: 'section',
      if: hidePrices,
      fields: { code: { type: 'text', required: true, default: 'NONE' } }
    }
  },
  tabs: {
    ...catalogueForm.tabs,
    first: {
      type: 'tab',
      fields: { label: { type: 'text', required: true, minLength: 5 } }
    },
    second: {
      type: 'tab',
      fields: {
        label: {
          type: 'text',
          minLength: 2,
          pattern: '^[a-z]+$',
          trim: true,
          default: 'label'
        }
      }
    }
  }
})

function createData() {
  return {
    ...createCatalogue(),
    slug: null,
    importId: 'import-1',
    published: '2026-10-23',
    nickname: null,
    rating: 8,
    address: { street: 'Main Street' },
    code: 'TOO LONG',
    label: 'A'
  }
}

describe('initializeData()', () => {
  it('sets the defaults of new data', () => {
    // Passwords stay missing:
    expect(initializeData(form, {}, services)).toEqual({
      title: null,
      showPrices: false,
      collections: [],
      vendors: [],
      slug: null,
      importId: null,
      published: null,
      nickname: '',
      rating: null,
      address: { street: null },
      // The first field with its own default sets it, also when hidden:
      code: 'NONE',
      summaryNote: null,
      notes: null,
      label: 'label'
    })
  })

  it('replaces `null` in text with `nullable: false`', () => {
    expect(initializeData(form, createData(), services).nickname).toBe('')
  })

  it('sets the defaults of new items of each form', () => {
    const data = createData()
    const [books, records] = data.collections
    books.items.push({ type: 'book', pages: 200 })
    records.items.push({ type: 'record' })
    initializeData(form, data, services)
    expect(books.items[2]).toEqual({
      type: 'book',
      name: null,
      pages: 200,
      onSale: false,
      price: null,
      chapters: [],
      tags: [],
      // The fields of `fields()` callbacks depend on the item:
      summary: null
    })
    expect(records.items[1]).toEqual({
      type: 'record',
      name: null,
      email: null,
      format: 'lp',
      tracks: []
    })
  })
})

describe('getDataValidationErrors()', () => {
  it('validates the values with all their shown fields', () => {
    expect(
      getDataValidationErrors(form, createData(), { services })
    ).toEqual({
      ...catalogueErrors,
      code: [{ message: 'must be at most 4 characters long' }],
      // One check against the property merged from both fields, with the
      // `minLength` of the first one:
      label: [
        { message: 'must be at least 5 characters long' },
        { message: 'must match pattern "^[a-z]+$"' }
      ]
      // `rating` validates as edited (4), not as stored (8), and `address`
      // holds only hidden fields, so its `validate()` doesn't run.
    })
  })

  it('validates the alternative fields that are shown', () => {
    const data = { ...createData(), showPrices: false, code: '' }
    expect(getDataValidationErrors(form, data, { services })).toMatchObject({
      code: [{ message: 'is required' }],
      address: [{ message: 'is invalid' }]
    })
  })
})

describe('serializeData()', () => {
  it('serializes the shown values', () => {
    const data = { ...createData(), label: ' Label ' }
    initializeData(form, data, services)
    expect(serializeData(form, null, data, '', { services })).toEqual({
      ...serializedCatalogue,
      // Computed values that the data model hasn't written yet stay:
      slug: null,
      published: '2026-10-23',
      nickname: '',
      rating: 8,
      code: 'TOO LONG',
      // The merged property trims, with `trim` of the second field:
      label: 'Label'
      // Changes with the one data mechanism, see plan: `address` holds only
      // hidden fields, so it isn't sent.
    })
  })

  it('serializes the alternative fields that are shown', () => {
    const data = { ...createData(), showPrices: false }
    initializeData(form, data, services)
    expect(serializeData(form, null, data, '', { services })).toMatchObject({
      code: 'TOO LONG',
      address: { street: 'Main Street' }
    })
  })
})

describe('deserializeData() and mergeData()', () => {
  it('converts the stored values to the edited ones', () => {
    const data = deserializeData(form, createData(), { services })
    expect(data.published).toEqual(new Date(2026, 9, 23))
    expect(data.label).toBe('A')
  })

  it('merges in place, also nested sections', () => {
    const target = createData()
    const source = {
      ...structuredClone(target),
      title: 'Merged',
      address: { street: 'Side Street' }
    }
    const { address, collections } = target
    mergeData(form, target, source, { services })
    expect(target).toEqual(source)
    expect(target.address).toBe(address)
    expect(target.collections).toBe(collections)
  })
})

describe('isDataPathExcluded()', () => {
  it('tells which values are left out of the data that is sent', () => {
    const data = createData()
    const dataPaths = [
      'slug',
      'importId',
      'published',
      'address',
      'address/street',
      'code',
      'label',
      'vendors/0/name',
      'unknown'
    ]
    expect(
      dataPaths.filter(dataPath =>
        isDataPathExcluded(form, data, dataPath, { services })
      )
    ).toEqual(['importId', 'unknown'])
  })
})

describe('getItemDisplayValue()', () => {
  it('displays the values with the first field of each value', () => {
    const sourceSchema = { type: 'list', name: 'catalogues', form }
    const item = deserializeData(form, createData(), { services })
    const context = new SchemaContext(services, {
      schema: sourceSchema,
      data: item,
      dataPath: '',
      rootData: item
    })
    const getDisplayValue = name =>
      getItemDisplayValue(sourceSchema, item, name, {
        services,
        dataPath: '',
        context
      })
    expect(
      ['published', 'label', 'code', 'importId'].map(getDisplayValue)
    ).toEqual(['Oct 23, 2026', 'A', 'TOO LONG', 'import-1'])
  })
})

describe('DataModel', () => {
  const createDataModel = () =>
    new DataModel({
      schema: () => form,
      data: reactive(createData()),
      services,
      canSave: () => true
    })

  it(`isn't dirty after the data is set up`, async () => {
    const dataModel = createDataModel()
    await nextTick()
    // Defaults and computed values are the model's own writes:
    expect(dataModel.data.slug).toBe('')
    expect(dataModel.isDirty).toBe(false)
    dataModel.stop()
  })

  it('is dirty after edits of values that are sent', async () => {
    const dataModel = createDataModel()
    const { data } = dataModel
    await nextTick()
    dataModel.set({ data, name: 'importId', dataPath: 'importId' }, 'import-2')
    expect(dataModel.isEdited).toBe(false)
    dataModel.set({ data, name: 'label', dataPath: 'label' }, 'Label')
    expect(dataModel.isDirty).toBe(true)
    dataModel.markClean()
    dataModel.set({ data, name: 'title', dataPath: 'title' }, 'Catalogue')
    await nextTick()
    expect(data.slug).toBe('catalogue')
    expect(dataModel.isDirty).toBe(true)
    dataModel.stop()
  })

  it('marks the edits in sources with their own resource for them', () => {
    const dataModel = createDataModel()
    const { data } = dataModel
    dataModel.set(
      { data: data.vendors[0], name: 'name', dataPath: 'vendors/0/name' },
      'Vendor'
    )
    // Their own submit saves them:
    expect(dataModel.isEdited).toBe(true)
    expect(dataModel.isDirty).toBe(false)
    dataModel.stop()
  })
})
