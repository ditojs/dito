import { vi } from 'vitest'
import SchemaContext from '../../SchemaContext.js'
import { defineType } from './types.ts'
import { sourceTraits } from '../../types/traits.ts'
import {
  walkSchemaData,
  getComponentPathByDataPath,
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

const chapters = {
  type: 'list',
  form: {
    type: 'form',
    components: { title: { type: 'text' } }
  }
}

const schema = {
  type: 'form',
  components: {
    title: { type: 'text' },
    publishing: {
      type: 'section',
      components: { publisher: { type: 'text' } }
    }
  },
  tabs: {
    structure: { type: 'tab', components: { chapters } },
    layout: { type: 'tab', components: { chapters } }
  },
  panels: {
    info: { type: 'panel', components: { note: { type: 'text' } } }
  }
}

const data = {
  title: 'Book',
  publisher: 'Publisher',
  note: 'Note',
  chapters: [{ title: 'One' }, { title: 'Two' }]
}

describe('walkSchemaData()', () => {
  it('passes the component paths of components, tabs and panels', () => {
    const componentPaths = {}
    walkSchemaData(schema, data, {
      dataPath: '',
      componentPath: 'book',
      shouldWalk: ({ componentPath, dataPath }) => {
        componentPaths[componentPath] = dataPath
        return true
      },
      options: { services: null }
    })
    expect(componentPaths).toEqual({
      'book/title': 'title',
      'book/publishing': '',
      'book/publishing/publisher': 'publisher',
      'book/structure': '',
      'book/structure/chapters': 'chapters',
      'book/structure/chapters/0/title': 'chapters/0/title',
      'book/structure/chapters/1/title': 'chapters/1/title',
      'book/layout': '',
      'book/layout/chapters': 'chapters',
      'book/layout/chapters/0/title': 'chapters/0/title',
      'book/layout/chapters/1/title': 'chapters/1/title',
      'book/info': '',
      'book/info/note': 'note'
    })
  })
})

describe('walkSchemaData() with child sources', () => {
  // Like trees, whose items hold their children:
  defineType({
    type: 'outline',
    sourceType: 'list',
    getChildSourceSchemas: schema => [schema.children]
  })

  it('walks the child sources of items like components of their forms', () => {
    const children = {
      type: 'list',
      name: 'sections',
      form: { type: 'form', components: { heading: { type: 'text' } } }
    }
    const componentPaths = {}
    walkSchemaData(
      {
        type: 'form',
        components: {
          outline: {
            type: 'outline',
            form: { type: 'form', components: { title: { type: 'text' } } },
            children
          }
        }
      },
      { outline: [{ title: 'Dune', sections: [{ heading: 'Arrakis' }] }] },
      {
        dataPath: '',
        componentPath: 'book',
        shouldWalk: ({ componentPath, dataPath }) => {
          componentPaths[componentPath] = dataPath
          return true
        },
        options: { services: null }
      }
    )
    expect(componentPaths).toEqual({
      'book/outline': 'outline',
      'book/outline/0/title': 'outline/0/title',
      'book/outline/0/sections': 'outline/0/sections',
      'book/outline/0/sections/0/heading': 'outline/0/sections/0/heading'
    })
  })

  it('walks child sources once that are components of the form too', () => {
    const children = {
      type: 'list',
      name: 'sections',
      form: { type: 'form', components: { heading: { type: 'text' } } }
    }
    const before = vi.fn()
    walkSchemaData(
      {
        type: 'form',
        components: {
          outline: {
            type: 'outline',
            form: { type: 'form', components: { sections: children } },
            children
          }
        }
      },
      { outline: [{ sections: [{ heading: 'Arrakis' }] }] },
      { dataPath: '', before, options: { services: null } }
    )
    const names = before.mock.calls.map(([{ name }]) => name)
    expect(names).toEqual(['outline', 'sections', 'heading'])
  })
})

describe('walkSchemaData() with panel components', () => {
  it('walks the components of panel components with their data', () => {
    const componentPaths = {}
    walkSchemaData(
      {
        type: 'form',
        components: {
          links: {
            type: 'panel',
            components: { website: { type: 'text' } }
          }
        }
      },
      { website: 'https://example.com' },
      {
        dataPath: '',
        componentPath: 'book',
        shouldWalk: ({ componentPath, dataPath }) => {
          componentPaths[componentPath] = dataPath
          return true
        },
        options: { services: null }
      }
    )
    expect(componentPaths).toEqual({
      'book/links': '',
      'book/links/website': 'website'
    })
  })
})

describe('walkSchemaData() with panels of nested components', () => {
  it('walks their components with the data around the components', () => {
    const componentPaths = {}
    walkSchemaData(
      {
        type: 'form',
        components: {
          chapters: {
            type: 'list',
            panels: {
              meta: {
                type: 'panel',
                components: { code: { type: 'text' } }
              }
            }
          }
        }
      },
      { chapters: [], code: 'A' },
      {
        dataPath: '',
        componentPath: 'book',
        shouldWalk: ({ componentPath, dataPath }) => {
          componentPaths[componentPath] = dataPath
          return true
        },
        options: { services: null }
      }
    )
    expect(componentPaths).toEqual({
      'book/chapters': 'chapters',
      'book/chapters/meta': '',
      'book/chapters/meta/code': 'code'
    })
  })
})

describe('walkSchemaData() with panels that have their own data', () => {
  it(`doesn't walk their components with the data of the schema`, () => {
    const componentPaths = []
    walkSchemaData(
      {
        type: 'form',
        components: {
          search: {
            type: 'panel',
            data: () => ({ term: null }),
            components: { term: { type: 'text' } }
          }
        },
        panels: {
          filters: {
            type: 'panel',
            data: () => ({ query: null }),
            components: { query: { type: 'text' } }
          }
        }
      },
      {},
      {
        dataPath: '',
        componentPath: '',
        shouldWalk: ({ componentPath }) => {
          componentPaths.push(componentPath)
          return true
        },
        options: { services: null }
      }
    )
    expect(componentPaths).toEqual(['search', 'filters'])
  })
})

describe('getComponentPathByDataPath()', () => {
  const getComponentPath = (dataPath, options) =>
    getComponentPathByDataPath(schema, data, dataPath, options)

  it('adds the names of tabs and unnested components', () => {
    expect(getComponentPath('title')).toBe('title')
    expect(getComponentPath('publisher')).toBe('publishing/publisher')
    expect(getComponentPath('note')).toBe('info/note')
  })

  it('appends the item indices of list items', () => {
    expect(getComponentPath('chapters/1')).toBe('structure/chapters/1')
    expect(getComponentPath('chapters/1/title')).toBe(
      'structure/chapters/1/title'
    )
  })

  it('uses the first component in schema order', () => {
    expect(getComponentPath('chapters')).toBe('structure/chapters')
  })

  it('appends the data path of values without component', () => {
    expect(getComponentPath('unknown/0')).toBe('unknown/0')
    expect(getComponentPath('chapters/0/unknown')).toBe(
      'structure/chapters/0/unknown'
    )
  })

  it('continues `componentPath`', () => {
    expect(getComponentPath('chapters/0', { componentPath: 'main' })).toBe(
      'main/structure/chapters/0'
    )
    expect(getComponentPathByDataPath(schema, null, 'chapters/0')).toBe(
      'chapters/0'
    )
  })
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

  it('returns the value if `computeValue()` returns `undefined`', () => {
    const data = { upper: 'Kept' }
    expect(getComputedValue(schema, data, 'upper', 'upper')).toBe('Kept')
  })

  it('returns the default of missing values without writing it', () => {
    const data = {}
    const schema = { type: 'text', default: 'Untitled' }
    expect(getComputedValue(schema, data, 'title', 'title')).toBe('Untitled')
    expect(data).toEqual({})
  })

  it('returns the defaults of nested sections that are `null`', () => {
    const chooser = { type: 'section', nested: true, components: {} }
    expect(
      getComputedValue(chooser, { chooser: null }, 'chooser', 'chooser')
    ).toEqual(
      {}
    )
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
      components: {
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
      components: {
        sizes: {
          type: 'list',
          form: {
            type: 'form',
            components: {
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
      components: {
        items: {
          type: 'list',
          form: {
            type: 'form',
            components: {
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
        components: {
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
        { type: 'form', components: { prices } },
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
      components: {
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
      components: {
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
      components: {
        works: {
          type: 'list',
          forms: {
            novel: {
              type: 'form',
              components: { title: { type: 'text' } }
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
      components: { title: { type: 'text' } }
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
    components: {
      prices: {
        type: 'list',
        wrapPrimitives: 'price',
        form: { type: 'form', components: { price } }
      }
    }
  })

  it('converts values with the hook of their type, then of the schema', () => {
    const schema = {
      type: 'form',
      components: {
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
      components: {
        items: {
          type: 'list',
          // Stored as an object keyed by id:
          deserializeValue: ({ value }) => Object.values(value),
          form: { type: 'form', components: { price: { type: 'amount' } } }
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
        components: { title: { type: 'text', deserializeValue } }
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
      components: { url: { type: 'text', if: condition } }
    }
    expect(shouldRenderSchema(links, context)).toBe(true)
    expect(condition).not.toHaveBeenCalled()
  })

  it('hides sections whose components are all hidden', () => {
    const context = new SchemaContext({}, { data: {}, dataPath: '' })
    const section = {
      type: 'section',
      components: { url: { type: 'text', if: () => false } }
    }
    expect(shouldRenderSchema(section, context)).toBe(false)
  })

  it('hides forms whose components are all hidden', () => {
    const context = new SchemaContext({}, { data: {}, dataPath: '' })
    const form = {
      type: 'form',
      components: { title: { type: 'text', if: () => false } }
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
      'Stored'
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
        components: { price: { type: 'text', default: 0 } }
      }
    }
    const data = { prices: [100, 200] }
    // `SchemaContext` needs a component to inherit from:
    initializeData({ type: 'form', components: { prices } }, data, {})
    expect(data).toEqual({ prices: [100, 200] })
  })

  it('sets the objects of nested sections that are `null`', () => {
    const chooser = {
      type: 'section',
      nested: true,
      components: { topic: { type: 'text', default: 'news' } }
    }
    const data = { chooser: null }
    initializeData({ type: 'form', components: { chooser } }, data, {})
    // The section's components are initialized in its object too:
    expect(data.chooser).toEqual({ topic: 'news' })
  })

  it('reads the flags of types that are booleans', () => {
    const schema = {
      type: 'form',
      components: { secret: { type: 'secret' }, choice: { type: 'choice' } }
    }
    expect(initializeData(schema, { choice: null })).toEqual({
      choice: 'none'
    })
  })

  it('can leave the defaults of computed values to `getComputedValue()`', () => {
    const pricing = {
      type: 'text',
      default: 'auto',
      computeValue: ({ value, item }) => (
        value ?? (item.customFactor != null ? 'factor' : undefined)
      )
    }
    const schema = { type: 'form', components: { pricing } }
    const data = { customFactor: 10 }
    initializeData(schema, data, null, {
      shouldSetDefaultsOfComponentsWithCompute: false
    })
    expect(data).toEqual({ customFactor: 10 })
    // New data starts with all defaults:
    expect(initializeData(schema, {})).toEqual({ pricing: 'auto' })
    expect(getComputedValue(pricing, data, 'pricing', 'pricing')).toBe('factor')
    expect(getComputedValue(pricing, {}, 'pricing', 'pricing')).toBe('auto')
  })

  it('numbers the items of lists with `orderKey`, also nested ones', () => {
    const parts = {
      type: 'list',
      orderKey: 'order',
      form: { type: 'form', components: { name: { type: 'text' } } }
    }
    const items = {
      type: 'list',
      orderKey: 'order',
      // Lists with `computeValue()` are numbered too.
      computeValue: ({ value }) => value,
      form: { type: 'form', components: { parts } }
    }
    const data = {
      items: [
        { order: 5, parts: [{ name: 'A', order: 2 }, { name: 'B', order: 7 }] },
        { order: 9, parts: [] }
      ]
    }
    initializeData(
      { type: 'form', tabs: { main: { type: 'tab', components: { items } } } },
      data,
      // `SchemaContext` needs a component to inherit from:
      {}
    )
    expect(data.items.map(item => item.order)).toEqual([0, 1])
    expect(data.items[0].parts.map(part => part.order)).toEqual([0, 1])
  })

  it('leaves lists without `orderKey` and of primitives untouched', () => {
    const form = { type: 'form', components: { name: { type: 'text' } } }
    const schema = {
      type: 'form',
      components: {
        items: { type: 'list', form },
        prices: {
          type: 'list',
          orderKey: 'order',
          wrapPrimitives: 'price',
          form: { type: 'form', components: { price: { type: 'text' } } }
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
    components: { title: { type: 'text' } },
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
        components: { title: { type: 'text', if: () => false } }
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
