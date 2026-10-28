import { vi } from 'vitest'
import SchemaContext from '../../SchemaContext.js'
import { defineType } from './types.ts'
import { nestableTraits, sourceTraits } from '../../types/traits.ts'
import {
  getComputedValue,
  serializeData,
  deserializeData,
  initializeData,
  getCreatableForms,
  getItemId,
  getItemUid,
  updateOrder
} from './data.js'

// Define minimal types, as the actual type components can't be
// imported without a Vue SFC compiler:
defineType({ type: 'text' })
defineType({ ...nestableTraits, type: 'section' })
defineType({ type: 'panel', defaultNested: false })
defineType({
  type: 'reference',
  serializeValue: ({ value }) => value && { id: value.id }
})
defineType({ ...sourceTraits, type: 'list', sourceType: 'list' })
// Amounts are stored in cents, and edited in units:
defineType({
  type: 'amount',
  deserializeValue: ({ value }) => value / 100,
  serializeValue: ({ value }) => Math.round(value * 100)
})
defineType({ type: 'label', defaultExclude: true })
// Flags of type descriptors can be plain booleans:
defineType({
  type: 'secret',
  defaultValue: 'none',
  ignoresMissingValue: true
})
defineType({ type: 'choice', defaultValue: 'none' })

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
    expect(initializeData(schema, {})).toEqual({
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

  it('keeps `null` in lists with a default of `null`', () => {
    const form = { type: 'form', fields: { name: { type: 'text' } } }
    const schema = {
      type: 'form',
      fields: {
        items: { type: 'list', form },
        parts: { type: 'list', form, default: null }
      }
    }
    const serialize = data =>
      serializeData(schema, null, data, '', { target: 'server' })
    const loaded = { items: null, parts: null }
    initializeData(schema, loaded, {})
    expect(loaded).toEqual({ items: [], parts: null })
    expect(serialize({ items: null, parts: null })).toEqual({
      items: [],
      parts: null
    })
    expect(initializeData(schema, {}, {})).toEqual({ items: [], parts: null })
    expect(serialize({})).toEqual({ items: [], parts: null })
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
