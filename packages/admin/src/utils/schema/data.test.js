import { vi } from 'vitest'
import SchemaContext from '../../SchemaContext.js'
import { defineType } from './types.ts'
import {
  sourceTraits,
  numberTraits,
  colorTraits
} from '../../types/traits.ts'
import {
  getComputedValue,
  serializeData,
  deserializeData,
  initializeData,
  shouldRenderSchema,
  getCreatableForms,
  getSchemaValue,
  getDefaultValue,
  shouldExcludeValue,
  getMultipleValue,
  parseEditedValue,
  getItemId,
  getItemUid,
  updateOrder
} from './data.js'

// Define minimal types, as the actual type components can't be
// imported without a Vue SFC compiler:
defineType({ type: 'text' })
defineType({
  type: 'section',
  defaultNested: false,
  defaultValue: ({ schema }) => (schema.nested ? {} : undefined),
  treatsNullAsMissing: ({ schema }) => !!schema.nested
})
defineType({ type: 'panel', defaultNested: false })
defineType({
  type: 'reference',
  serializeValue: ({ value }) => value && { id: value.id }
})
defineType({ ...sourceTraits, type: 'list', sourceType: 'list' })
defineType({ type: 'tags', defaultMultiple: true })
defineType({ ...numberTraits, type: ['number', 'integer'] })
defineType({ ...colorTraits, type: 'color' })
// Amounts are stored in cents, and edited in units:
defineType({
  type: 'amount',
  deserializeValue: ({ value }) => value / 100,
  serializeValue: ({ value }) => Math.round(value * 100)
})
defineType({ type: 'hidden', defaultExclude: true })
// Flags of type descriptors can be plain booleans:
defineType({
  type: 'secret',
  defaultValue: 'none',
  ignoresMissingValue: true
})
defineType({
  type: 'choice',
  defaultValue: 'none',
  treatsNullAsMissing: true
})

describe('getComputedValue()', () => {
  const schema = {
    type: 'text',
    computeValue: ({ item }) => item.title?.toUpperCase()
  }

  it('returns the computed value without writing it into the data', () => {
    const data = { title: 'Book' }
    expect(getComputedValue(schema, data, 'upper', 'upper')).toBe('BOOK')
    expect(data).toEqual({ title: 'Book' })
  })

  it('returns `undefined` when nothing is computed', () => {
    expect(getComputedValue(schema, {}, 'upper', 'upper')).toBe(undefined)
    expect(
      getComputedValue({ type: 'text' }, { title: 'Kept' }, 'title', 'title')
    ).toBe(undefined)
  })

  it('provides the data path to `computeValue()`', () => {
    const schema = { type: 'text', computeValue: ({ dataPath }) => dataPath }
    expect(getComputedValue(schema, {}, 'path', 'chapters/0/path')).toBe(
      'chapters/0/path'
    )
  })

  it('calls data path functions only when `computeValue()` reads them', () => {
    const getDataPath = vi.fn(() => 'chapters/1/path')
    const readsDataPath = {
      type: 'text',
      computeValue: ({ dataPath }) => dataPath
    }
    const ignoresDataPath = { type: 'text', computeValue: () => 'Fixed' }
    expect(getComputedValue(ignoresDataPath, {}, 'path', getDataPath)).toBe(
      'Fixed'
    )
    expect(getDataPath).not.toHaveBeenCalled()
    expect(getComputedValue(readsDataPath, {}, 'path', getDataPath)).toBe(
      'chapters/1/path'
    )
    expect(getDataPath).toHaveBeenCalledOnce()
  })

  it('provides `context.options` through `getOptions()` when read', () => {
    const options = ['Small', 'Large']
    const getOptions = vi.fn(() => options)
    const schema = {
      type: 'text',
      computeValue: context => context.value ?? context.options[0]
    }
    expect(
      getComputedValue(schema, { size: 'Large' }, 'size', 'size', {
        getOptions
      })
    ).toBe('Large')
    expect(getOptions).not.toHaveBeenCalled()
    expect(getComputedValue(schema, {}, 'size', 'size', { getOptions })).toBe(
      'Small'
    )
    expect(getOptions).toHaveBeenCalledTimes(1)
  })
})

describe('serializeData()', () => {
  it('serializes the values in the data without calling `computeValue()`', () => {
    // `DataModel` writes the computed values into the data.
    const computeValue = vi.fn(({ item }) => item.title.toUpperCase())
    const schema = {
      type: 'form',
      fields: {
        title: { type: 'text' },
        upper: { type: 'text', computeValue },
        subtitle: { type: 'text', default: 'None' }
      }
    }
    const data = { title: 'Book', upper: 'BOOK' }
    expect(
      serializeData(schema, { type: 'list' }, data, '', { target: 'server' })
    ).toEqual({ title: 'Book', upper: 'BOOK', subtitle: 'None' })
    expect(data).toEqual({ title: 'Book', upper: 'BOOK' })
    expect(computeValue).not.toHaveBeenCalled()
  })

  it('keeps values that are no objects as they are', () => {
    // E.g. sizes that are stored as numbers, before `computeValue()` converts
    // them to the objects that their forms edit.
    const schema = {
      type: 'form',
      fields: {
        sizes: {
          type: 'list',
          form: {
            type: 'form',
            fields: {
              value: { type: 'text' },
              units: { type: 'text' }
            }
          }
        }
      }
    }
    const data = { sizes: [5, { value: 10, units: '%' }] }
    expect(
      serializeData(schema, { type: 'list' }, data, '', {
        services: {},
        rootData: data,
        target: 'server'
      })
    ).toEqual({ sizes: [5, { value: 10, units: '%' }] })
  })

  it('provides the values of missing components to their callbacks', () => {
    // Reading `value` in callbacks reads it from the data, not through the
    // data path from the root data, which doesn't hold missing values.
    const schema = {
      type: 'form',
      fields: {
        items: {
          type: 'list',
          form: {
            type: 'form',
            fields: {
              status: { type: 'text', default: ({ value }) => value ?? 'New' }
            }
          }
        }
      }
    }
    const data = { items: [{}] }
    expect(
      serializeData(schema, { type: 'list' }, data, '', {
        services: {},
        rootData: data,
        target: 'server'
      })
    ).toEqual({ items: [{ status: 'New' }] })
  })

  it('serializes the primitive values of lists with `wrapPrimitives`', () => {
    const dataPaths = []
    const prices = {
      type: 'list',
      wrapPrimitives: 'price',
      form: {
        type: 'form',
        fields: {
          price: {
            type: 'text',
            serializeValue: ({ value, dataPath }) => {
              dataPaths.push(dataPath)
              return value * 2
            }
          }
        }
      }
    }
    expect(
      serializeData(
        { type: 'form', fields: { prices } },
        { type: 'list' },
        { prices: [100, 200] },
        '',
        { services: {}, target: 'server' }
      )
    ).toEqual({ prices: [200, 400] })
    // The values are serialized at the data paths of the items:
    expect(dataPaths).toEqual(['prices/0', 'prices/1'])
  })

  it('converts values with the hook of their type, then of the schema', () => {
    const schema = {
      type: 'form',
      fields: {
        price: { type: 'amount', serializeValue: ({ value }) => `${value}` }
      }
    }
    expect(
      serializeData(schema, null, { price: 12.5 }, '', {
        services: {},
        target: 'server'
      })
    ).toEqual({ price: '1250' })
  })

  it('leaves out the values that `serializeValue()` returns nothing for', () => {
    // E.g. virtual fields, which write the actual values:
    const schema = {
      type: 'form',
      fields: {
        name: {
          type: 'text',
          serializeValue({ value, serializedItem }) {
            const [first, last] = value.split(' ')
            Object.assign(serializedItem, { first, last })
          }
        }
      }
    }
    const serializedData = serializeData(
      schema,
      null,
      { name: 'Jane Austen' },
      '',
      { services: {}, target: 'server' }
    )
    expect(serializedData).not.toHaveProperty('name')
    expect(serializedData).toEqual({ first: 'Jane', last: 'Austen' })
  })

  it('passes items without a matching form through as shallow clones', () => {
    const essay = { type: 'essay', title: 'On Reading', notes: 'Draft' }
    const schema = {
      type: 'form',
      fields: {
        works: {
          type: 'list',
          forms: {
            novel: {
              type: 'form',
              fields: { title: { type: 'text' } }
            }
          }
        }
      }
    }
    const data = { works: [essay] }
    const serialized = serializeData(schema, { type: 'list' }, data, '', {
      services: {},
      rootData: data,
      target: 'server'
    })
    expect(serialized.works[0]).toEqual(essay)
    expect(serialized.works[0]).not.toBe(essay)
  })

  describe('of items', () => {
    const options = { services: {}, target: 'server' }
    const schema = {
      type: 'form',
      fields: { title: { type: 'text' } }
    }
    const data = { id: 1, type: 'novel', title: 'Emma', notes: 'Draft' }

    it('only keeps the id and the values of the components', () => {
      expect(
        serializeData(schema, { type: 'list', form: schema }, data, '', options)
      ).toEqual({ id: 1, title: 'Emma' })
    })

    it('keeps the type of items of sources with multiple forms', () => {
      // The type tells which of the forms the item belongs to:
      const sourceSchema = {
        type: 'list',
        forms: { novel: schema, poem: schema }
      }
      expect(serializeData(schema, sourceSchema, data, '', options)).toEqual({
        id: 1,
        type: 'novel',
        title: 'Emma'
      })
    })
  })
})

describe('deserializeData()', () => {
  const createPricesSchema = price => ({
    type: 'form',
    fields: {
      prices: {
        type: 'list',
        wrapPrimitives: 'price',
        form: { type: 'form', fields: { price } }
      }
    }
  })

  it('converts values with the hook of their type, then of the schema', () => {
    const schema = {
      type: 'form',
      fields: {
        price: { type: 'amount', deserializeValue: ({ value }) => `${value}` }
      }
    }
    const data = { price: 1250 }
    expect(deserializeData(schema, data)).toBe(data)
    expect(data).toEqual({ price: '12.5' })
  })

  it('converts the values of sources before the values of their items', () => {
    const schema = {
      type: 'form',
      fields: {
        items: {
          type: 'list',
          // Stored as an object keyed by id:
          deserializeValue: ({ value }) => Object.values(value),
          form: { type: 'form', fields: { price: { type: 'amount' } } }
        }
      }
    }
    const data = { items: { a: { id: 'a', price: 100 } } }
    deserializeData(schema, data)
    expect(data).toEqual({ items: [{ id: 'a', price: 1 }] })
  })

  it('writes the converted primitives of `wrapPrimitives` lists back', () => {
    const data = { prices: [100, 250] }
    deserializeData(createPricesSchema({ type: 'amount' }), data)
    expect(data).toEqual({ prices: [1, 2.5] })
  })

  it('leaves missing values to their defaults', () => {
    const deserializeValue = vi.fn()
    const data = {}
    deserializeData(
      {
        type: 'form',
        fields: { title: { type: 'text', deserializeValue } }
      },
      data
    )
    expect(data).toEqual({})
    expect(deserializeValue).not.toHaveBeenCalled()
  })
})

describe('shouldRenderSchema()', () => {
  it(`doesn't evaluate the components of sources for their items`, () => {
    // `SchemaContext` needs a component to inherit from:
    const context = new SchemaContext(
      {},
      { data: { links: null }, dataPath: '' }
    )
    const condition = vi.fn(({ item }) => !!item.url)
    const links = {
      type: 'list',
      fields: { url: { type: 'text', if: condition } }
    }
    expect(shouldRenderSchema(links, context)).toBe(true)
    expect(condition).not.toHaveBeenCalled()
  })

  it('hides sections whose components are all hidden', () => {
    const context = new SchemaContext({}, { data: {}, dataPath: '' })
    const section = {
      type: 'section',
      fields: { url: { type: 'text', if: () => false } }
    }
    expect(shouldRenderSchema(section, context)).toBe(false)
  })

  it('hides forms whose components are all hidden', () => {
    const context = new SchemaContext({}, { data: {}, dataPath: '' })
    const form = {
      type: 'form',
      fields: { title: { type: 'text', if: () => false } }
    }
    expect(shouldRenderSchema(form, context)).toBe(false)
  })
})

describe('getComputedValue() with if', () => {
  it(`doesn't compute values of components whose if is false`, () => {
    const schema = {
      type: 'text',
      if: ({ item }) => !!item.preview,
      computeValue: ({ item }) => item.preview.name
    }
    expect(getComputedValue(schema, { name: 'Stored' }, 'name', 'name')).toBe(
      undefined
    )
    expect(
      getComputedValue(schema, { preview: { name: 'Preview' } }, 'name', 'name')
    ).toBe('Preview')
  })
})

describe('initializeData()', () => {
  it('keeps the primitive values of lists with wrapPrimitives', () => {
    const prices = {
      type: 'list',
      wrapPrimitives: 'price',
      form: {
        type: 'form',
        fields: { price: { type: 'text', default: 0 } }
      }
    }
    const data = { prices: [100, 200] }
    // `SchemaContext` needs a component to inherit from:
    initializeData({ type: 'form', fields: { prices } }, data, {})
    expect(data).toEqual({ prices: [100, 200] })
  })

  it('sets the objects of nested sections that are `null`', () => {
    const chooser = {
      type: 'section',
      nested: true,
      fields: { topic: { type: 'text', default: 'news' } }
    }
    const data = { chooser: null }
    initializeData({ type: 'form', fields: { chooser } }, data, {})
    // The section's components are initialized in its object too:
    expect(data.chooser).toEqual({ topic: 'news' })
  })

  it('reads the flags of types that are booleans', () => {
    const schema = {
      type: 'form',
      fields: { secret: { type: 'secret' }, choice: { type: 'choice' } }
    }
    expect(initializeData(schema, { choice: null })).toEqual({
      choice: 'none'
    })
  })

  it('can leave the defaults of computed values to the data model', () => {
    const pricing = {
      type: 'text',
      default: 'auto',
      computeValue: ({ value, item }) => (
        value ?? (item.customFactor != null ? 'factor' : undefined)
      )
    }
    const schema = { type: 'form', fields: { pricing } }
    const data = { customFactor: 10 }
    initializeData(schema, data, null, {
      shouldSetDefaultsOfComputedValues: false
    })
    expect(data).toEqual({ customFactor: 10 })
    // New data starts with all defaults:
    expect(initializeData(schema, {})).toEqual({ pricing: 'auto' })
    expect(getComputedValue(pricing, data, 'pricing', 'pricing')).toBe('factor')
  })

  it('numbers the items of lists with `orderKey`, also nested ones', () => {
    const parts = {
      type: 'list',
      orderKey: 'order',
      form: { type: 'form', fields: { name: { type: 'text' } } }
    }
    const items = {
      type: 'list',
      orderKey: 'order',
      // Lists with `computeValue()` are numbered too.
      computeValue: ({ value }) => value,
      form: { type: 'form', fields: { parts } }
    }
    const data = {
      items: [
        { order: 5, parts: [{ name: 'A', order: 2 }, { name: 'B', order: 7 }] },
        { order: 9, parts: [] }
      ]
    }
    initializeData(
      { type: 'form', tabs: { main: { type: 'tab', fields: { items } } } },
      data,
      // `SchemaContext` needs a component to inherit from:
      {}
    )
    expect(data.items.map(item => item.order)).toEqual([0, 1])
    expect(data.items[0].parts.map(part => part.order)).toEqual([0, 1])
  })

  it('leaves lists without `orderKey` and of primitives untouched', () => {
    const form = { type: 'form', fields: { name: { type: 'text' } } }
    const schema = {
      type: 'form',
      fields: {
        items: { type: 'list', form },
        prices: {
          type: 'list',
          orderKey: 'order',
          wrapPrimitives: 'price',
          form: { type: 'form', fields: { price: { type: 'text' } } }
        }
      }
    }
    const data = { items: [{ name: 'A', order: 5 }], prices: [100, 200] }
    initializeData(schema, data, {})
    expect(data).toEqual({
      items: [{ name: 'A', order: 5 }],
      prices: [100, 200]
    })
  })
})

describe('getCreatableForms()', () => {
  // `SchemaContext` needs a component to inherit from:
  const createContext = data => new SchemaContext({}, { data, dataPath: '' })
  const createForm = settings => ({
    type: 'form',
    fields: { title: { type: 'text' } },
    ...settings
  })

  it('returns the forms for which items can be created', () => {
    const forms = {
      article: createForm(),
      event: createForm({ creatable: true }),
      archived: createForm({ creatable: false })
    }
    expect(getCreatableForms({ forms }, createContext({}))).toEqual({
      article: forms.article,
      event: forms.event
    })
  })

  it('evaluates `creatable` callbacks with the context', () => {
    const context = createContext({ isLocked: true })
    const creatable = vi.fn(({ item }) => !item.isLocked)
    const forms = {
      default: createForm({ creatable }),
      note: createForm()
    }
    expect(getCreatableForms({ forms }, context)).toEqual({
      note: forms.note
    })
    expect(creatable).toHaveBeenCalledOnce()
  })

  it('ignores the `if` and `visible` of forms and their components', () => {
    const forms = {
      hidden: createForm({ if: false }),
      invisible: createForm({ visible: false }),
      empty: createForm({
        fields: { title: { type: 'text', if: () => false } }
      })
    }
    expect(getCreatableForms({ forms }, createContext({}))).toEqual(forms)
  })

  it('returns an empty object for schemas without forms', () => {
    expect(getCreatableForms({ type: 'list' }, createContext({}))).toEqual({})
  })
})

describe('getSchemaValue()', () => {
  it('reads data paths in array format', () => {
    const schema = { options: { label: 'Title' } }
    expect(getSchemaValue(['options', 'label'], { schema })).toBe('Title')
    expect(
      getSchemaValue(['options', 'missing', 'label'], {
        schema,
        default: 'None'
      })
    ).toBe('None')
  })

  it('returns the default without a schema', () => {
    expect(getSchemaValue('label', { default: 'Untitled' })).toBe('Untitled')
    expect(getSchemaValue('label')).toBe(undefined)
  })

  it('calls `default()` with the context, unless functions are expected', () => {
    const context = { item: { title: 'Emma' } }
    const getTitle = ({ item }) => item.title
    expect(getSchemaValue('label', { default: getTitle, context })).toBe(
      'Emma'
    )
    expect(
      getSchemaValue('render', { type: Function, default: getTitle, context })
    ).toBe(getTitle)
    expect(
      getSchemaValue('label', { default: getTitle, callback: false })
    ).toBe(getTitle)
  })

  it('converts values to the expected type', () => {
    expect(
      getSchemaValue('pageSize', { type: Number, schema: { pageSize: '20' } })
    ).toBe(20)
    expect(
      getSchemaValue('creatable', {
        type: [Boolean, Object],
        schema: { creatable: () => 1 }
      })
    ).toBe(true)
  })

  it('skips expected types that have no conversion', () => {
    expect(
      getSchemaValue('pageSize', {
        type: [Function, Number],
        schema: { pageSize: '20' }
      })
    ).toBe(20)
    // Without any conversion, the value is returned as it is:
    expect(
      getSchemaValue('render', { type: Function, schema: { render: 'none' } })
    ).toBe('none')
  })
})

describe('getDefaultValue()', () => {
  it('calls `default()` with contexts that are passed directly', () => {
    const context = { item: { title: 'Emma' } }
    const schema = { type: 'text', default: ({ item }) => item.title }
    expect(getDefaultValue(schema, context)).toBe('Emma')
  })

  it('clones default values, so that they are not shared', () => {
    const tags = ['new']
    const value = getDefaultValue({ type: 'text', default: tags }, {})
    expect(value).toEqual(tags)
    expect(value).not.toBe(tags)
  })
})

describe('shouldExcludeValue()', () => {
  it('calls `exclude()` with the context', () => {
    const exclude = vi.fn(({ item }) => item.isDraft)
    const schema = { type: 'text', exclude }
    expect(shouldExcludeValue(schema, () => ({ item: { isDraft: true } })))
      .toBe(true)
    expect(shouldExcludeValue(schema, { item: { isDraft: false } })).toBe(
      false
    )
  })

  it('falls back on the `defaultExclude` of the type', () => {
    expect(shouldExcludeValue({ type: 'hidden' }, {})).toBe(true)
    expect(shouldExcludeValue({ type: 'hidden', exclude: false }, {})).toBe(
      false
    )
    expect(shouldExcludeValue({ type: 'text' }, {})).toBe(false)
  })
})

describe('getMultipleValue()', () => {
  it('prefers `multiple` over the `defaultMultiple` of the type', () => {
    expect(getMultipleValue({ type: 'tags' })).toBe(true)
    expect(getMultipleValue({ type: 'tags', multiple: false })).toBe(false)
    expect(getMultipleValue({ type: 'text' })).toBe(false)
    expect(getMultipleValue({ type: 'text', multiple: true })).toBe(true)
  })
})

describe('parseEditedValue()', () => {
  const parse = (schema, value) =>
    parseEditedValue(schema, value, value => ({ schema, value }))

  it('parses the entered strings of number types', () => {
    expect(parse({ type: 'number' }, '4.5')).toBe(4.5)
    expect(parse({ type: 'integer' }, '42')).toBe(42)
    expect(parse({ type: 'number' }, '')).toBe(null)
    expect(parse({ type: 'number' }, null)).toBe(null)
  })

  it('converts colors to the format of `colorFormat`', () => {
    expect(parse({ type: 'color' }, 'ff8000')).toBe('#ff8000')
    expect(parse({ type: 'color' }, 'rgba(0, 0, 255, 0.5)')).toBe('#0000ff80')
    expect(
      parse({ type: 'color', colorFormat: 'hex3' }, '#ff0000')
    ).toBe('#f00')
    expect(parse({ type: 'color', colorFormat: 'rgb' }, '#ff0000')).toEqual({
      r: 255,
      g: 0,
      b: 0,
      a: 1
    })
    expect(parse({ type: 'color', colorFormat: 'hsl' }, '#ff0000')).toEqual({
      h: 0,
      s: 1,
      l: 0.5,
      a: 1
    })
    expect(parse({ type: 'color' }, null)).toBe(null)
  })

  it('calls `parseValue()` with the value parsed by the type', () => {
    const schema = { type: 'number', parseValue: ({ value }) => value * 2 }
    expect(parse(schema, '21')).toBe(42)
  })
})

describe('getItemId()', () => {
  it('returns the id under `idKey` as a string', () => {
    expect(getItemId({ type: 'list' }, { id: 7 })).toBe('7')
    expect(getItemId({ type: 'list', idKey: 'isbn' }, { isbn: 978 })).toBe(
      '978'
    )
  })

  it('returns `undefined` for items without an id', () => {
    expect(getItemId({ type: 'list' }, { title: 'Draft' })).toBe(undefined)
    expect(getItemId({ type: 'list' }, { id: null })).toBe(undefined)
  })
})

describe('getItemUid()', () => {
  it('uses the ids of items, or else generated uids', () => {
    const schema = { type: 'list' }
    expect(getItemUid(schema, { id: 3 })).toBe('3')
    const draft = { title: 'Draft' }
    const uid = getItemUid(schema, draft)
    expect(uid).toEqual(expect.any(String))
    expect(uid).not.toBe('undefined')
    // The uid stays with the item, also once it has an id:
    draft.id = 4
    expect(getItemUid(schema, draft)).toBe(uid)
  })
})

describe('updateOrder()', () => {
  it('numbers the items by their order key, starting at the offset', () => {
    const list = [{ title: 'A' }, { title: 'B' }]
    expect(updateOrder({ orderKey: 'position' }, list, 10)).toBe(list)
    expect(list).toEqual([
      { title: 'A', position: 10 },
      { title: 'B', position: 11 }
    ])
  })

  it('leaves the items alone without an order key', () => {
    const list = [{ title: 'A' }]
    expect(updateOrder({ type: 'list' }, list)).toBe(list)
    expect(list).toEqual([{ title: 'A' }])
  })
})
