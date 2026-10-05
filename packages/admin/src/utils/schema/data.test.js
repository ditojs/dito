import { vi } from 'vitest'
import DitoContext from '../../DitoContext.js'
import { registerTypeComponent } from './types.js'
import {
  processSchemaData,
  getComponentPathByDataPath,
  computeValue,
  processData,
  initializeData,
  shouldRenderSchema
} from './data.js'

// Register minimal type options, as the actual type components can't be
// imported without a Vue SFC compiler:
registerTypeComponent('text', { defaultNested: true })
registerTypeComponent('section', {
  defaultNested: false,
  defaultValue: ({ schema }) => (schema.nested ? {} : undefined),
  treatNullAsMissing: ({ schema }) => !!schema.nested
})
registerTypeComponent('panel', { defaultNested: false })
registerTypeComponent('reference', {
  defaultNested: true,
  processValue: ({ value }) => value && { id: value.id }
})
registerTypeComponent('list', {
  defaultNested: true,
  getSourceType: () => 'list'
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

describe('processSchemaData()', () => {
  it('passes the component paths of components, tabs and panels', () => {
    const componentPaths = {}
    processSchemaData(schema, data, {
      dataPath: '',
      componentPath: 'book',
      shouldProcess: ({ componentPath, dataPath }) => {
        componentPaths[componentPath] = dataPath
        return true
      },
      options: { component: null }
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

describe('processSchemaData() with panel components', () => {
  it('walks the components of panel components with their data', () => {
    const componentPaths = {}
    processSchemaData(
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
        shouldProcess: ({ componentPath, dataPath }) => {
          componentPaths[componentPath] = dataPath
          return true
        },
        options: { component: null }
      }
    )
    expect(componentPaths).toEqual({
      'book/links': '',
      'book/links/website': 'website'
    })
  })
})

describe('processSchemaData() with panels of nested components', () => {
  it('walks their components with the data around the components', () => {
    const componentPaths = {}
    processSchemaData(
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
        shouldProcess: ({ componentPath, dataPath }) => {
          componentPaths[componentPath] = dataPath
          return true
        },
        options: { component: null }
      }
    )
    expect(componentPaths).toEqual({
      'book/chapters': 'chapters',
      'book/chapters/meta': '',
      'book/chapters/meta/code': 'code'
    })
  })
})

describe('processSchemaData() with panels that have their own data', () => {
  it("doesn't walk their components with the data of the schema", () => {
    const componentPaths = []
    processSchemaData(
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
        shouldProcess: ({ componentPath }) => {
          componentPaths.push(componentPath)
          return true
        },
        options: { component: null }
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

describe('computeValue()', () => {
  const schema = {
    type: 'text',
    compute: ({ item }) => item.title?.toUpperCase()
  }

  it('returns the computed value without writing it into the data', () => {
    const data = { title: 'Book' }
    expect(computeValue(schema, data, 'upper', 'upper')).toBe('BOOK')
    expect(data).toEqual({ title: 'Book' })
  })

  it('returns the value if `compute()` returns `undefined`', () => {
    const data = { upper: 'Kept' }
    expect(computeValue(schema, data, 'upper', 'upper')).toBe('Kept')
  })

  it('returns the default of missing values without writing it', () => {
    const data = {}
    const schema = { type: 'text', default: 'Untitled' }
    expect(computeValue(schema, data, 'title', 'title')).toBe('Untitled')
    expect(data).toEqual({})
  })

  it('returns the defaults of nested sections that are `null`', () => {
    const chooser = { type: 'section', nested: true, components: {} }
    expect(
      computeValue(chooser, { chooser: null }, 'chooser', 'chooser')
    ).toEqual(
      {}
    )
  })

  it('provides `context.options` through `getOptions()` when read', () => {
    const options = ['Small', 'Large']
    const getOptions = vi.fn(() => options)
    const schema = {
      type: 'text',
      compute: context => context.value ?? context.options[0]
    }
    expect(
      computeValue(schema, { size: 'Large' }, 'size', 'size', { getOptions })
    ).toBe('Large')
    expect(getOptions).not.toHaveBeenCalled()
    expect(computeValue(schema, {}, 'size', 'size', { getOptions })).toBe(
      'Small'
    )
    expect(getOptions).toHaveBeenCalledTimes(1)
  })
})

describe('processData()', () => {
  it('processes computed values without writing into the data', () => {
    const schema = {
      type: 'form',
      components: {
        title: { type: 'text' },
        upper: {
          type: 'text',
          compute: ({ item }) => item.title.toUpperCase()
        },
        subtitle: { type: 'text', default: 'None' }
      }
    }
    const data = { title: 'Book' }
    expect(
      processData(schema, { type: 'list' }, data, '', { target: 'server' })
    ).toEqual({ title: 'Book', upper: 'BOOK', subtitle: 'None' })
    expect(data).toEqual({ title: 'Book' })
  })

  it('processes the primitive values of lists with `wrapPrimitives`', () => {
    const dataPaths = []
    const prices = {
      type: 'list',
      wrapPrimitives: 'price',
      form: {
        type: 'form',
        components: {
          price: {
            type: 'text',
            process: ({ value, dataPath }) => {
              dataPaths.push(dataPath)
              return value * 2
            }
          }
        }
      }
    }
    expect(
      processData(
        { type: 'form', components: { prices } },
        { type: 'list' },
        { prices: [100, 200] },
        '',
        { component: {}, target: 'server' }
      )
    ).toEqual({ prices: [200, 400] })
    // The values are processed at the data paths of the items:
    expect(dataPaths).toEqual(['prices/0', 'prices/1'])
  })

  describe('with `shouldCallComputeAndProcess: false`', () => {
    // `DitoContext` needs a component to inherit from:
    const component = {}
    const options = {
      component,
      target: 'clipboard',
      shouldCallComputeAndProcess: false
    }

    it('falls back to defaults without calling `compute()`', () => {
      const compute = vi.fn(() => 'Computed')
      const process = vi.fn(({ value }) => value)
      const schema = {
        type: 'form',
        components: {
          title: { type: 'text', process },
          upper: { type: 'text', compute, default: 'None' }
        }
      }
      expect(
        processData(schema, { type: 'list' }, { title: 'Book' }, '', options)
      ).toEqual({ title: 'Book', upper: 'None' })
      expect(compute).not.toHaveBeenCalled()
      expect(process).not.toHaveBeenCalled()
    })

    it("processes values through their types' `processValue()`", () => {
      const schema = {
        type: 'form',
        components: { author: { type: 'reference' } }
      }
      const data = { author: { id: 1, name: 'Author' } }
      expect(processData(schema, { type: 'list' }, data, '', options)).toEqual({
        author: { id: 1 }
      })
    })

    it('keeps excluded values of components with `process()`', () => {
      const schema = {
        type: 'form',
        components: {
          tagsText: {
            type: 'text',
            exclude: true,
            process: ({ value, processedItem }) => {
              processedItem.tags = value.split(',')
            }
          },
          search: { type: 'text', exclude: true }
        }
      }
      const data = { tagsText: 'a,b', search: 'Search' }
      expect(processData(schema, { type: 'list' }, data, '', options)).toEqual({
        tagsText: 'a,b'
      })
      expect(
        processData(schema, { type: 'list' }, data, '', {
          component,
          target: 'server'
        })
      ).toEqual({ tags: ['a', 'b'] })
    })
  })
})

describe('shouldRenderSchema()', () => {
  it("doesn't evaluate the components of sources for their items", () => {
    // `DitoContext` needs a component to inherit from:
    const context = new DitoContext({}, { data: { links: null }, dataPath: '' })
    const condition = vi.fn(({ item }) => !!item.url)
    const links = {
      type: 'list',
      components: { url: { type: 'text', if: condition } }
    }
    expect(shouldRenderSchema(links, context)).toBe(true)
    expect(condition).not.toHaveBeenCalled()
  })

  it('hides sections whose components are all hidden', () => {
    const context = new DitoContext({}, { data: {}, dataPath: '' })
    const section = {
      type: 'section',
      components: { url: { type: 'text', if: () => false } }
    }
    expect(shouldRenderSchema(section, context)).toBe(false)
  })
})

describe('computeValue() with if', () => {
  it("doesn't compute values of components whose if is false", () => {
    const schema = {
      type: 'text',
      if: ({ item }) => !!item.preview,
      compute: ({ item }) => item.preview.name
    }
    expect(computeValue(schema, { name: 'Stored' }, 'name', 'name')).toBe(
      'Stored'
    )
    expect(
      computeValue(schema, { preview: { name: 'Preview' } }, 'name', 'name')
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
    // `DitoContext` needs a component to inherit from:
    initializeData({ type: 'form', components: { prices } }, data, {})
    expect(data).toEqual({ prices: [100, 200] })
  })

  it('sets the objects of nested sections that are `null`', () => {
    const chooser = {
      type: 'section',
      nested: true,
      components: { topic: { type: 'text' } }
    }
    const data = { chooser: null }
    initializeData({ type: 'form', components: { chooser } }, data, {})
    // The section's components are initialized in its object too:
    expect(data.chooser).toHaveProperty('topic')
  })

  it('can leave the defaults of computed values to `computeValue()`', () => {
    const pricing = {
      type: 'text',
      default: 'auto',
      compute: ({ value, item }) => (
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
    expect(computeValue(pricing, data, 'pricing', 'pricing')).toBe('factor')
    expect(computeValue(pricing, {}, 'pricing', 'pricing')).toBe('auto')
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
      // Lists with `compute()` are numbered too.
      compute: ({ value }) => value,
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
      // `DitoContext` needs a component to inherit from:
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
