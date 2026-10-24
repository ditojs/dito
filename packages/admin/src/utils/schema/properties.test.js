import { vi } from 'vitest'
import { hyphenate } from '@ditojs/utils'
import { reactive } from 'vue'
import '../../types/index.js'
import SchemaContext from '../../SchemaContext.js'
import { setupForm } from './setup.js'
import { defineType } from './types.ts'
import { walkData } from './walk.js'
import { getFormProperties, checkProperties } from './properties.js'
import {
  initializeData,
  serializeData,
  deserializeData,
  isDataPathExcluded,
  getItemDisplayValue
} from './data.js'
import { getDataValidationErrors } from './validation.js'
import { mergeData } from '../mergeData.ts'
import { toClipboard } from '../toClipboard.ts'
import { fromClipboard } from '../fromClipboard.ts'
import { getUploadEntries } from '../interchange.ts'

async function getProperties(fields, schema = {}, services = null) {
  const api = { defaults: {}, normalizePath: hyphenate }
  const form = await setupForm(api, { type: 'form', fields, ...schema })
  const context = SchemaContext.createForSchema(services, {
    schema: form,
    data: {},
    dataPath: ''
  })
  return getFormProperties(form, context)
}

describe('getFormProperties()', () => {
  describe('text types', () => {
    it('describes strings that are empty as `null`', async () => {
      expect(
        await getProperties({
          title: { type: 'text' },
          body: { type: 'textarea' },
          html: { type: 'markup' },
          source: { type: 'code' },
          phone: { type: 'tel' }
        })
      ).toEqual({
        title: { type: 'string', nullable: true },
        body: { type: 'string', nullable: true },
        html: { type: 'string', nullable: true },
        source: { type: 'string', nullable: true },
        phone: { type: 'string', nullable: true }
      })
    })

    it('describes strings with `nullable: false` as empty strings', async () => {
      expect(
        await getProperties({ title: { type: 'text', nullable: false } })
      ).toEqual({
        title: { type: 'string', default: '' }
      })
    })

    it('adds the formats of the server', async () => {
      expect(
        await getProperties({
          email: { type: 'email' },
          website: { type: 'url' },
          host: { type: 'hostname' },
          password: { type: 'password' }
        })
      ).toEqual({
        email: { type: 'string', format: 'email', nullable: true },
        website: { type: 'string', format: 'uri', nullable: true },
        host: { type: 'string', format: 'hostname', nullable: true },
        password: { type: 'string', format: 'password', nullable: true }
      })
    })

    it('leaves out the formats that the server lacks', async () => {
      expect(
        await getProperties({
          domain: { type: 'domain' },
          card: { type: 'creditcard' }
        })
      ).toEqual({
        domain: { type: 'string', nullable: true },
        card: { type: 'string', nullable: true }
      })
    })

    it('adds `required` and the limits of strings', async () => {
      expect(
        await getProperties({
          code: {
            type: 'text',
            required: true,
            minLength: 2,
            maxLength: 8,
            pattern: '^[A-Z]+$'
          }
        })
      ).toEqual({
        code: {
          type: 'string',
          required: true,
          minLength: 2,
          maxLength: 8,
          pattern: '^[A-Z]+$',
          nullable: true
        }
      })
    })
  })

  describe('number types', () => {
    it('describes numbers that are empty as `null`', async () => {
      expect(
        await getProperties({
          price: { type: 'number' },
          pages: { type: 'integer' },
          volume: { type: 'slider' },
          done: { type: 'progress' }
        })
      ).toEqual({
        price: { type: 'number', nullable: true },
        pages: { type: 'integer', nullable: true },
        volume: { type: 'number', nullable: true },
        done: { type: 'number', nullable: true }
      })
    })

    it('adds the limits of numbers', async () => {
      expect(
        await getProperties({
          rating: { type: 'number', minimum: 0, maximum: 5 },
          year: { type: 'integer', range: [1900, 2100] },
          price: { type: 'number', minimum: 0 },
          discount: { type: 'number', maximum: 50 }
        })
      ).toEqual({
        rating: { type: 'number', nullable: true, minimum: 0, maximum: 5 },
        year: { type: 'integer', range: [1900, 2100], nullable: true },
        price: { type: 'number', minimum: 0, nullable: true },
        discount: { type: 'number', maximum: 50, nullable: true }
      })
    })

    it('adds `decimals`', async () => {
      expect(
        await getProperties({ price: { type: 'number', decimals: 2 } })
      ).toEqual({
        price: { type: 'number', decimals: 2, nullable: true }
      })
    })
  })

  describe('boolean types', () => {
    it('describes checkboxes that are empty as `null`, switches as `false`', async () => {
      expect(
        await getProperties({
          isAnswered: { type: 'checkbox' },
          isPublic: { type: 'checkbox', nullable: false },
          isListed: { type: 'switch' },
          isActive: { type: 'switch', default: true }
        })
      ).toEqual({
        isAnswered: { type: 'boolean', nullable: true },
        isPublic: { type: 'boolean', default: false },
        isListed: { type: 'boolean', default: false },
        isActive: { type: 'boolean', default: true }
      })
    })
  })

  describe('date types', () => {
    it('describes dates, and times as date-times', async () => {
      expect(
        await getProperties({
          day: { type: 'date', required: true },
          opensAt: { type: 'datetime' },
          opensAtTime: { type: 'time', formats: { time: 'short' } }
        })
      ).toEqual({
        day: { type: 'date', required: true, nullable: true },
        opensAt: { type: 'datetime', nullable: true },
        opensAtTime: { type: 'datetime', nullable: true }
      })
    })
  })

  describe('color type', () => {
    it('describes hex colors as colors, other formats as objects', async () => {
      expect(
        await getProperties({
          background: { type: 'color' },
          overlay: { type: 'color', colorFormat: 'hex8', default: '#ff000080' },
          tint: { type: 'color', colorFormat: 'rgb' }
        })
      ).toEqual({
        background: { type: 'color', nullable: true },
        overlay: { type: 'color', default: '#ff000080', nullable: true },
        tint: { type: 'object', nullable: true }
      })
    })
  })

  describe('options types', () => {
    const genres = [
      { value: 'jazz', label: 'Jazz' },
      { value: 'rock', label: 'Rock' }
    ]

    it('describes the values of static options', async () => {
      expect(
        await getProperties({
          format: { type: 'select', options: ['hardcover', 'paperback'] },
          genre: { type: 'radio', options: { data: genres }, required: true },
          count: { type: 'select', options: [{ count: 1 }, { count: 2 }] },
          size: {
            type: 'select',
            options: { data: [{ id: 's' }, { id: 'l' }], value: 'id' }
          }
        })
      ).toEqual({
        format: {
          type: 'string',
          enum: ['hardcover', 'paperback'],
          nullable: true
        },
        genre: {
          type: 'string',
          enum: ['jazz', 'rock'],
          required: true,
          nullable: true
        },
        count: { type: 'object', nullable: true },
        size: { type: 'string', enum: ['s', 'l'], nullable: true }
      })
    })

    it('leaves `null` options to `nullable`', async () => {
      expect(
        await getProperties({
          rating: { type: 'select', options: [null, 1, 2, 3] }
        })
      ).toEqual({
        rating: { type: 'number', enum: [1, 2, 3], nullable: true }
      })
    })

    it('leaves out `enum` where values may miss options', async () => {
      expect(
        await getProperties({
          country: {
            type: 'select',
            options: { data: genres, equals: () => true }
          },
          keyword: { type: 'multiselect', options: ['a'], taggable: true },
          author: { type: 'multiselect', options: ['a'], search: {} },
          tag: { type: 'multiselect', options: ['a'], taggable: () => true },
          editor: { type: 'multiselect', options: ['a'], search: () => [] }
        })
      ).toEqual({
        country: { type: 'string', nullable: true },
        keyword: { type: 'string', nullable: true },
        author: { type: 'string', nullable: true },
        tag: { type: 'string', nullable: true },
        editor: { type: 'string', nullable: true }
      })
    })

    it('describes the values of loaded options as any value', async () => {
      expect(
        await getProperties({
          author: { type: 'select', options: { data: async () => [] } },
          editor: { type: 'select', options: { dataPath: 'editors' } },
          value: { type: 'select', options: [1, 'one'] }
        })
      ).toEqual({ author: {}, editor: {}, value: {} })
    })

    it('describes `multiple` values as arrays', async () => {
      expect(
        await getProperties({
          genres: { type: 'checkboxes', options: genres, required: true },
          formats: {
            type: 'multiselect',
            multiple: true,
            options: ['hardcover'],
            minItems: 2
          }
        })
      ).toEqual({
        genres: {
          type: 'array',
          items: { type: 'string', enum: ['jazz', 'rock'] },
          required: true,
          minItems: 1,
          default: []
        },
        formats: {
          type: 'array',
          items: { type: 'string', enum: ['hardcover'] },
          minItems: 2,
          default: []
        }
      })
    })

    it('describes related values as objects', async () => {
      const options = { data: async () => [], label: 'name' }
      expect(
        await getProperties({
          author: { type: 'select', relate: true, options },
          editors: { type: 'checkboxes', relate: 'key', options }
        })
      ).toEqual({
        author: { type: 'object', nullable: true },
        editors: { type: 'array', items: { type: 'object' }, default: [] }
      })
    })
  })

  describe('upload type', () => {
    it('describes files as assets', async () => {
      expect(
        await getProperties({
          image: { type: 'upload' },
          images: { type: 'upload', multiple: true, required: true }
        })
      ).toEqual({
        image: { type: 'asset', nullable: true },
        images: {
          type: 'array',
          items: { type: 'asset' },
          required: true,
          minItems: 1,
          default: []
        }
      })
    })
  })

  describe('value and component types', () => {
    const component = {
      emits: ['update:modelValue', 'change'],
      props: ['schema', 'context', 'modelValue'],
      render: () => null
    }

    it('describes their values as any value', async () => {
      expect(
        await getProperties({
          total: { type: 'value', computeValue: () => 1 },
          votes: { type: 'component', component, default: 0 }
        })
      ).toEqual({
        total: {},
        votes: { default: 0 }
      })
    })

    it('describes components without `default` as any value too', async () => {
      expect(
        await getProperties({ rating: { type: 'component', component } })
      ).toEqual({ rating: {} })
    })
  })

  describe('sections and panels', () => {
    const fields = { street: { type: 'text' } }
    const properties = { street: { type: 'string', nullable: true } }

    it('describes the fields of unnested sections in the form', async () => {
      expect(
        await getProperties({
          address: {
            type: 'section',
            fields,
            tabs: {
              city: { type: 'tab', fields: { city: { type: 'text' } } }
            }
          }
        })
      ).toEqual({ ...properties, city: { type: 'string', nullable: true } })
    })

    it('describes nested sections as objects', async () => {
      expect(
        await getProperties({
          address: { type: 'section', nested: true, fields },
          billing: { type: 'section', nested: true, required: true, fields }
        })
      ).toEqual({
        address: { type: 'object', properties, default: {} },
        billing: { type: 'object', properties, required: true, default: {} }
      })
    })

    it('describes the panels of fields, except with their own data', async () => {
      expect(
        await getProperties({
          name: {
            type: 'text',
            panels: {
              info: { type: 'panel', fields },
              address: { type: 'panel', nested: true, fields },
              filters: { type: 'panel', data: () => ({}), fields }
            }
          }
        })
      ).toEqual({
        name: { type: 'string', nullable: true },
        ...properties,
        address: { type: 'object', properties, default: {} }
      })
    })

    it('leaves out the fields of `fields()` callbacks', async () => {
      expect(
        await getProperties({
          address: { type: 'section', fields: () => fields },
          billing: { type: 'section', nested: true, fields: () => fields }
        })
      ).toEqual({
        billing: { type: 'object', default: {} }
      })
    })
  })

  describe('source types', () => {
    const form = {
      type: 'form',
      fields: { title: { type: 'text', required: true } }
    }
    const item = {
      type: 'object',
      properties: {
        title: { type: 'string', required: true, nullable: true }
      }
    }

    it('describes objects by the properties of their form', async () => {
      expect(
        await getProperties({
          publisher: { type: 'object', form },
          author: { type: 'object', fields: form.fields, required: true }
        })
      ).toEqual({
        publisher: { ...item, nullable: true },
        author: { ...item, required: true, nullable: true }
      })
    })

    it('describes lists as arrays of their items', async () => {
      expect(
        await getProperties({
          chapters: { type: 'list', form },
          notes: { type: 'list', form, required: true, maxItems: 5 },
          tags: { type: 'list', form, minItems: 2 }
        })
      ).toEqual({
        chapters: { type: 'array', items: item, default: [] },
        notes: {
          type: 'array',
          items: item,
          required: true,
          minItems: 1,
          maxItems: 5,
          default: []
        },
        tags: { type: 'array', items: item, minItems: 2, default: [] }
      })
    })

    it('describes items by the written properties of their form', async () => {
      const component = { name: 'TitleLayout' }
      const form = { type: 'form', properties: item.properties, component }
      expect(
        await getProperties({
          publisher: { type: 'object', form },
          chapters: { type: 'list', form }
        })
      ).toEqual({
        publisher: { ...item, nullable: true },
        chapters: { type: 'array', items: item, default: [] }
      })
    })

    it('describes the items of the forms of views', async () => {
      const books = { type: 'view', field: { type: 'list', form } }
      expect(
        await getProperties(
          { favorites: { type: 'list', view: 'books' } },
          {},
          { flattenedViews: { books } }
        )
      ).toEqual({
        favorites: { type: 'array', items: item, default: [] }
      })
    })

    it('describes wrapped primitives as the values of their field', async () => {
      expect(
        await getProperties({
          prices: {
            type: 'list',
            wrapPrimitives: 'price',
            form: {
              type: 'form',
              fields: { price: { type: 'number', minimum: 0 } }
            }
          }
        })
      ).toEqual({
        prices: {
          type: 'array',
          items: { type: 'number', minimum: 0, nullable: true },
          default: []
        }
      })
    })

    it('describes the items of several forms by their `type`', async () => {
      expect(
        await getProperties({
          blocks: {
            type: 'list',
            forms: {
              text: form,
              spacer: {
                type: 'form',
                fields: { height: { type: 'integer' } }
              }
            }
          }
        })
      ).toEqual({
        blocks: {
          type: 'array',
          items: {
            type: 'object',
            discriminator: { propertyName: 'type' },
            oneOf: [
              {
                properties: { ...item.properties, type: { const: 'text' } }
              },
              {
                properties: {
                  height: { type: 'integer', nullable: true },
                  type: { const: 'spacer' }
                }
              }
            ]
          },
          default: []
        }
      })
    })

    it('describes the children of trees in their items', async () => {
      const childForm = {
        type: 'form',
        fields: { name: { type: 'text' } }
      }
      expect(
        await getProperties({
          parts: {
            type: 'tree-list',
            form,
            children: {
              name: 'sections',
              form: childForm,
              children: { name: 'paragraphs', form: childForm }
            }
          }
        })
      ).toEqual({
        parts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ...item.properties,
              sections: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', nullable: true },
                    paragraphs: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: { name: { type: 'string', nullable: true } }
                      },
                      default: []
                    }
                  }
                },
                default: []
              }
            }
          },
          default: []
        }
      })
    })

    it('leaves out the items of `fields()` callbacks', async () => {
      expect(
        await getProperties({
          chapters: {
            type: 'list',
            form: { type: 'form', fields: () => ({}) }
          },
          publisher: { type: 'object', fields: () => ({}) }
        })
      ).toEqual({
        chapters: { type: 'array', default: [] },
        publisher: { type: 'object', nullable: true }
      })
    })

    it('skips sources with a resource', async () => {
      expect(
        await getProperties({
          reviews: { type: 'list', resource: 'reviews', form },
          publisher: { type: 'object', resource: 'publishers', form }
        })
      ).toEqual({})
    })

    it('skips sources with resource callbacks', async () => {
      expect(
        await getProperties({
          reviews: { type: 'list', resource: () => 'reviews', form },
          publisher: { type: 'object', resource: () => 'publishers', form }
        })
      ).toEqual({})
    })

    it('skips sources with resource callbacks in their own forms', async () => {
      // Pages that list their child pages, loaded by their own resource:
      const page = {
        type: 'form',
        fields: {
          title: { type: 'text' },
          children: {
            type: 'list',
            form: () => page,
            resource: ({ item }) => `pages/${item.id}/children`
          }
        }
      }
      expect(
        await getProperties({ page: { type: 'object', form: page } })
      ).toEqual({
        page: {
          type: 'object',
          properties: { title: { type: 'string', nullable: true } },
          nullable: true
        }
      })
    })
  })

  it('leaves out the data keywords with callbacks', async () => {
    expect(
      await getProperties({
        title: {
          type: 'text',
          required: ({ item }) => item.isPublic,
          maxLength: () => 10,
          default: () => 'Untitled'
        },
        price: { type: 'number', range: () => [0, 10] },
        tint: { type: 'color', colorFormat: () => 'rgb' },
        size: { type: 'select', options: ['s', 'm'], taggable: () => true }
      })
    ).toEqual({
      title: { type: 'string', nullable: true },
      price: { type: 'number', nullable: true },
      tint: { type: 'color', nullable: true },
      size: { type: 'string', nullable: true }
    })
  })

  it('describes the fields of tabs', async () => {
    expect(
      await getProperties(
        { title: { type: 'text' } },
        {
          tabs: {
            notes: { type: 'tab', fields: { note: { type: 'textarea' } } }
          }
        }
      )
    ).toEqual({
      title: { type: 'string', nullable: true },
      note: { type: 'string', nullable: true }
    })
  })

  it('skips fields without data', async () => {
    expect(
      await getProperties({
        title: { type: 'text' },
        heading: { type: 'label' },
        save: { type: 'button' }
      })
    ).toEqual({
      title: { type: 'string', nullable: true }
    })
  })
})

describe('written properties', () => {
  const services = { adminContext: { api: { defaults: {} } } }
  const createForm = properties => ({ type: 'form', properties })
  const initialize = (properties, data = {}) =>
    initializeData(createForm(properties), data, services)
  const validate = (properties, data) =>
    getDataValidationErrors(createForm(properties), data, { services })
  const serialize = (properties, data) =>
    serializeData(createForm(properties), null, data, '', { services })

  describe('defaults', () => {
    it('start with the empty values of the server', () => {
      expect(
        initialize({
          title: { type: 'string' },
          subtitle: { type: 'string', nullable: true },
          isFeatured: { type: 'boolean' },
          rank: { type: 'integer' },
          awards: { type: 'array', items: { type: 'object', properties: {} } },
          address: {
            type: 'object',
            properties: { city: { type: 'string' } }
          },
          location: { type: 'object', nullable: true, properties: {} }
        })
      ).toEqual({
        title: '',
        subtitle: null,
        isFeatured: false,
        rank: null,
        awards: [],
        address: { city: '' },
        location: null
      })
    })

    it('take `default`, also of callbacks, and keep values', () => {
      expect(
        initialize(
          {
            format: { type: 'string', default: 'lp' },
            code: { type: 'string', default: ({ item }) => item.format },
            title: { type: 'string', default: 'Untitled' }
          },
          { title: 'Notes' }
        )
      ).toEqual({ format: 'lp', code: 'lp', title: 'Notes' })
    })

    it('replace `null` unless the property is `nullable`', () => {
      const awards = { type: 'array', items: { type: 'string' } }
      const address = {
        type: 'object',
        properties: { city: { type: 'string' } }
      }
      expect(
        initialize(
          {
            title: { type: 'string' },
            format: { type: 'string', default: 'lp' },
            isFeatured: { type: 'boolean' },
            rank: { type: 'integer' },
            day: { type: 'date' },
            awards,
            address,
            subtitle: { type: 'string', nullable: true },
            prizes: { ...awards, nullable: true },
            location: { ...address, nullable: true }
          },
          {
            title: null,
            format: null,
            isFeatured: null,
            rank: null,
            day: null,
            awards: null,
            address: null,
            subtitle: null,
            prizes: null,
            location: null
          }
        )
      ).toEqual({
        // The empty values of strings, booleans, lists and objects:
        title: '',
        format: 'lp',
        isFeatured: false,
        awards: [],
        address: { city: '' },
        // Their empty value is `null`:
        rank: null,
        day: null,
        // `nullable` values keep `null`:
        subtitle: null,
        prizes: null,
        location: null
      })
    })

    it('leave out passwords, which stay unchanged', () => {
      expect(
        initialize({ secret: { type: 'string', format: 'password' } })
      ).toEqual({})
    })

    it('are given by the nodes, also where they are not set', () => {
      const properties = {
        title: { type: 'string', default: 'Untitled' },
        subtitle: { type: 'string', nullable: true },
        isFeatured: { type: 'boolean' },
        rank: { type: 'integer' },
        awards: { type: 'array', items: { type: 'string' } },
        address: { type: 'object', properties: {} },
        secret: { type: 'string', format: 'password' }
      }
      const values = {}
      walkData(
        createForm(properties),
        { title: 'Notes' },
        {
          dataPath: '',
          services,
          visit: entry => {
            const node = entry.node.getPropertyNode(entry)
            values[entry.name] = {
              empty: node.getEmptyValue(entry),
              default: node.getDefaultValue(entry)
            }
          }
        }
      )
      expect(values).toEqual({
        title: { empty: '', default: 'Untitled' },
        subtitle: { empty: null, default: null },
        isFeatured: { empty: false, default: false },
        rank: { empty: null, default: null },
        awards: { empty: [], default: [] },
        address: { empty: {}, default: {} },
        secret: { empty: '', default: '' }
      })
    })

    it('number the items by `orderKey`', () => {
      expect(
        initialize(
          {
            awards: {
              type: 'array',
              orderKey: 'order',
              items: { type: 'object', properties: {} }
            }
          },
          { awards: [{}, {}] }
        )
      ).toEqual({ awards: [{ order: 0 }, { order: 1 }] })
    })
  })

  describe('`if`', () => {
    const properties = {
      isFeatured: { type: 'boolean' },
      rank: {
        type: 'integer',
        required: true,
        default: 1,
        if: ({ item }) => item.isFeatured
      }
    }

    it('leaves out irrelevant values in validation and data', () => {
      const data = initialize(properties, { isFeatured: false })
      expect(data).toEqual({ isFeatured: false, rank: 1 })
      expect(validate(properties, { ...data, rank: null })).toBe(null)
      expect(serialize(properties, { ...data, rank: 3 })).toEqual({
        isFeatured: false
      })
    })

    it('handles relevant values', () => {
      const data = initialize(properties, { isFeatured: true })
      expect(data).toEqual({ isFeatured: true, rank: 1 })
      expect(validate(properties, { ...data, rank: null })).toEqual({
        rank: [{ message: 'is required' }]
      })
      expect(serialize(properties, data)).toEqual(data)
    })
  })

  describe('validation', () => {
    it('checks the keywords of the server, also of callbacks', () => {
      expect(
        validate(
          {
            name: { type: 'string', required: true },
            code: { type: 'string', maxLength: ({ item }) => item.limit },
            limit: { type: 'integer' },
            count: { type: 'integer' },
            pages: { type: 'integer', minimum: 1 },
            price: { type: 'number', range: [0, 10], decimals: 2 },
            format: { type: 'string', enum: ['lp', 'cd'] },
            email: { type: 'string', format: 'email' },
            website: { type: 'string', format: 'uri' },
            published: { type: 'date' },
            tracks: { type: 'array', minItems: 1, items: { properties: {} } }
          },
          {
            name: '',
            code: 'abcd',
            limit: 2,
            count: 1.5,
            pages: 0,
            price: 3.333,
            format: 'mp3',
            email: 'nope',
            website: 'example.com',
            published: new Date('soon'),
            tracks: []
          }
        )
      ).toEqual({
        name: [{ message: 'is required' }],
        code: [{ message: 'must be at most 2 characters long' }],
        count: [{ message: 'must be a whole number' }],
        pages: [{ message: 'must be 1 or more' }],
        price: [{ message: 'must be a number with at most 2 decimal places' }],
        format: [{ message: 'must be one of the options' }],
        email: [{ message: 'must be a valid email' }],
        website: [{ message: 'is not a valid URL' }],
        published: [{ message: 'must be a valid date' }],
        tracks: [{ message: 'must contain at least one item' }]
      })
    })

    it('requires values that are `null` only with `required`', () => {
      expect(
        validate(
          {
            title: { type: 'string' },
            rank: { type: 'integer' },
            day: { type: 'date', required: true },
            price: { type: 'number', nullable: true }
          },
          { title: null, rank: null, day: null, price: null }
        )
      ).toEqual({ day: [{ message: 'is required' }] })
    })

    it('calls `validate()` with the value', () => {
      expect(
        validate(
          {
            code: {
              type: 'string',
              validate: ({ value, item }) => (
                value === item.name || 'must match the name'
              )
            },
            name: { type: 'string' }
          },
          { code: 'a', name: 'b' }
        )
      ).toEqual({ code: [{ message: 'must match the name' }] })
    })

    it('validates the items of lists by their forms', () => {
      const book = { properties: { pages: { type: 'integer', minimum: 1 } } }
      const record = {
        properties: { name: { type: 'string', required: true } }
      }
      expect(
        validate(
          { items: { type: 'array', forms: { book, record } } },
          {
            items: [
              { type: 'book', pages: 0 },
              { type: 'record', name: '' }
            ]
          }
        )
      ).toEqual({
        'items/0/pages': [{ message: 'must be 1 or more' }],
        'items/1/name': [{ message: 'is required' }]
      })
    })
  })

  it('handle each name that shares a property object', () => {
    const name = { type: 'string', required: true }
    const properties = { firstName: name, lastName: name }
    expect(initialize(properties)).toEqual({ firstName: '', lastName: '' })
    expect(validate(properties, { firstName: 'Ada', lastName: '' })).toEqual({
      lastName: [{ message: 'is required' }]
    })
    expect(serialize(properties, { firstName: 'Ada', lastName: 'Lovelace' }))
      .toEqual({ firstName: 'Ada', lastName: 'Lovelace' })
  })

  describe('data', () => {
    it('converts dates', () => {
      const properties = {
        published: { type: 'date' },
        updated: { type: 'datetime' }
      }
      const data = deserializeData(createForm(properties), {
        published: '2026-10-21',
        updated: '2026-10-21T10:30:00.000Z'
      })
      expect(data.published).toBeInstanceOf(Date)
      expect(data.updated).toEqual(new Date('2026-10-21T10:30:00.000Z'))
      expect(serialize(properties, data)).toEqual({
        published: '2026-10-21',
        updated: '2026-10-21T10:30:00.000Z'
      })
    })

    it('sends the stored files of assets like upload fields', () => {
      const properties = {
        image: { type: 'asset', nullable: true },
        cover: { type: 'asset', nullable: true },
        pending: { type: 'asset', nullable: true },
        gallery: { type: 'array', items: { type: 'asset' } }
      }
      const stored = { key: 'a', name: 'a.png', upload: { success: true } }
      const pending = { name: 'b.png', upload: { success: false } }
      expect(
        serialize(properties, {
          image: stored,
          cover: null,
          pending,
          gallery: [stored, stored]
        })
      ).toEqual({
        image: { key: 'a', name: 'a.png' },
        cover: null,
        pending: null,
        gallery: [
          { key: 'a', name: 'a.png' },
          { key: 'a', name: 'a.png' }
        ]
      })
    })

    it('keeps the items of arrays that serialize to nothing', () => {
      const properties = {
        tags: {
          type: 'array',
          items: {
            type: 'string',
            serializeValue: ({ value }) => value || undefined
          }
        }
      }
      expect(serialize(properties, { tags: ['a', '', 'b'] })).toEqual({
        tags: ['a', undefined, 'b']
      })
    })

    it('trims strings, and sends empty `nullable` ones as `null`', () => {
      expect(
        serialize(
          {
            title: { type: 'string', trim: true },
            subtitle: { type: 'string', trim: true, nullable: true }
          },
          { title: '  ', subtitle: '  ' }
        )
      ).toEqual({ title: '', subtitle: null })
    })

    it('converts with the value hooks', () => {
      const properties = {
        tags: {
          type: 'string',
          deserializeValue: ({ value }) => value.split(','),
          serializeValue: ({ value }) => value.join(',')
        }
      }
      const data = deserializeData(createForm(properties), { tags: 'a,b' })
      expect(data).toEqual({ tags: ['a', 'b'] })
      expect(serialize(properties, data)).toEqual({ tags: 'a,b' })
    })

    it('leaves out excluded and computed values', () => {
      const properties = {
        name: { type: 'string' },
        importName: { type: 'string', exclude: true },
        slug: { type: 'string', computed: true }
      }
      const form = createForm(properties)
      const data = { name: 'a', importName: 'b', slug: 'c' }
      expect(serialize(properties, data)).toEqual({ name: 'a' })
      expect(isDataPathExcluded(form, data, 'importName')).toBe(true)
      expect(isDataPathExcluded(form, data, 'slug')).toBe(true)
      expect(isDataPathExcluded(form, data, 'name')).toBe(false)
    })

    it('sends the items with their ids, types and order', () => {
      const entry = { properties: { title: { type: 'string' } } }
      expect(
        serialize(
          {
            entries: {
              type: 'array',
              idKey: 'key',
              orderKey: 'order',
              forms: { entry, note: entry }
            }
          },
          {
            entries: [
              { key: 1, type: 'note', order: 0, title: 'One', other: 1 }
            ]
          }
        )
      ).toEqual({
        entries: [{ key: 1, type: 'note', order: 0, title: 'One' }]
      })
    })

    it('handles lists of primitives by the property of their items', () => {
      const properties = {
        tags: {
          type: 'array',
          items: { type: 'string', required: true, trim: true, nullable: true }
        },
        dates: { type: 'array', items: { type: 'date' } },
        images: { type: 'array', items: { type: 'asset' } }
      }
      const data = deserializeData(createForm(properties), {
        tags: ['a', ' b ', ''],
        dates: ['2026-10-21'],
        images: [{ key: 'a', name: 'a.png' }]
      })
      expect(data.dates[0]).toBeInstanceOf(Date)
      expect(validate(properties, data)).toEqual({
        'tags/2': [{ message: 'is required' }]
      })
      expect(serialize(properties, data)).toEqual({
        tags: ['a', 'b', null],
        dates: ['2026-10-21'],
        images: [{ key: 'a', name: 'a.png' }]
      })
    })

    it('merges the items in place, matching them by `idKey`', () => {
      const form = createForm({
        entries: {
          type: 'array',
          idKey: 'key',
          items: { type: 'object', properties: { title: { type: 'string' } } }
        }
      })
      const item = { key: 1, title: 'One' }
      const target = { entries: [item] }
      mergeData(
        form,
        target,
        { entries: [{ key: 1, title: 'Uno' }] },
        {
          services
        }
      )
      expect(target.entries[0]).toBe(item)
      expect(item.title).toBe('Uno')
    })
  })

  describe('relations', () => {
    const properties = {
      owner: { type: 'object', relate: true, required: true },
      tags: { type: 'array', relate: 'code', items: { type: 'object' } }
    }
    const form = createForm(properties)
    const createData = () => ({
      owner: { id: 1, name: 'Ada' },
      tags: [{ code: 'a', label: 'A' }]
    })

    it('start empty and validate as values', () => {
      expect(initialize(properties)).toEqual({ owner: null, tags: [] })
      expect(validate(properties, { owner: null, tags: [] })).toEqual({
        owner: [{ message: 'is required' }]
      })
    })

    it('send the ids of the related objects', () => {
      expect(serialize(properties, createData())).toEqual({
        owner: { id: 1 },
        tags: [{ code: 'a' }]
      })
    })

    it('replace the related objects in merges', () => {
      const target = createData()
      const [tag] = target.tags
      mergeData(form, target, {
        owner: null,
        tags: [{ code: 'a', label: 'B' }]
      })
      expect(target.owner).toBe(null)
      expect(target.tags[0]).not.toBe(tag)
      expect(target.tags[0].label).toBe('B')
    })

    it('keep the ids of the related objects in copies', async () => {
      const data = createData()
      const copy = await toClipboard(form, { type: 'list', form }, data, '', {
        services,
        rootData: data
      })
      expect(copy).toEqual({ owner: { id: 1 }, tags: [{ code: 'a' }] })
      expect((await fromClipboard(form, copy, { services })).data).toEqual(
        copy
      )
    })
  })

  it('copy only the values with properties, also in nested objects', async () => {
    const form = createForm({
      title: { type: 'string' },
      address: { type: 'object', properties: { city: { type: 'string' } } }
    })
    const data = {
      id: 1,
      title: 'Talk',
      notes: 'Draft',
      address: { id: 2, city: 'Basel', zip: '4051' }
    }
    const copy = await toClipboard(form, { type: 'list', form }, data, '', {
      services,
      rootData: data
    })
    expect(copy).toEqual({ title: 'Talk', address: { city: 'Basel' } })
  })

  it('find the assets in clipboard data', () => {
    const form = createForm({
      cover: { type: 'asset', nullable: true },
      pages: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            images: { type: 'array', items: { type: 'asset' } }
          }
        }
      }
    })
    const data = { cover: null, pages: [{ images: [] }] }
    const entries = getUploadEntries(form, data, {
      dataPath: '',
      services,
      rootData: data
    })
    expect(entries.map(({ dataPath }) => dataPath)).toEqual([
      'cover',
      'pages/0/images'
    ])
  })

  it('display dates and times in the formats of the admin', () => {
    const list = {
      type: 'list',
      form: createForm({
        day: { type: 'date' },
        time: { type: 'string', format: 'iso-time' },
        title: { type: 'string' }
      })
    }
    const date = new Date(2026, 9, 22, 14, 30)
    const item = { day: date, time: date, title: 'Talk' }
    const context = new SchemaContext(services, {
      schema: list,
      data: item,
      dataPath: '',
      rootData: item
    })
    const getDisplayValue = name =>
      getItemDisplayValue(list, item, name, { services, dataPath: '', context })
    expect(['day', 'time', 'title'].map(getDisplayValue)).toEqual([
      'October 22, 2026',
      '02:30:00 PM',
      'Talk'
    ])
  })

  describe('checkProperties()', () => {
    it('rejects what properties can not describe yet', () => {
      const check = property => () => checkProperties({ value: property })
      expect(check({ type: 'object', $ref: '#node' })).toThrow(
        `Unsupported property keyword: '$ref'.`
      )
      expect(check({ type: 'string', relate: true })).toThrow(
        `Unsupported property: 'relate' on 'string'.`
      )
      expect(
        check({ type: 'array', relate: true, items: { type: 'string' } })
      ).toThrow(`Unsupported property: 'relate' on 'array'.`)
      expect(check({ type: 'array' })).toThrow(
        `Unsupported property: 'array' without 'items'.`
      )
      expect(check({ type: 'array', items: { type: 'text' } })).toThrow(
        `Unsupported property type: 'text'.`
      )
      expect(check({ type: 'text' })).toThrow(
        `Unsupported property type: 'text'.`
      )
      expect(check({ type: 'string', format: 'phone' })).toThrow(
        `Unsupported property format: 'phone'.`
      )
      expect(
        check({
          type: 'array',
          items: {
            type: 'object',
            properties: { owner: { type: 'object', definitions: {} } }
          }
        })
      ).toThrow(`Unsupported property keyword: 'definitions'.`)
      expect(() =>
        checkProperties({
          owner: { type: 'object', relate: true },
          tags: { type: 'array', relate: true, items: { type: 'object' } }
        })
      ).not.toThrow()
    })
  })
})

describe('properties of fields', () => {
  const api = { defaults: {}, normalizePath: hyphenate }
  const services = { adminContext: { api } }

  // The entries of the walk by data path, with the nodes of all their fields:
  function getEntries(form, data = {}) {
    const entries = {}
    walkData(form, data, {
      dataPath: '',
      services,
      visit: entry => {
        entries[entry.dataPath] = entry
      }
    })
    return entries
  }

  async function getPropertyNodes(fields, data = {}) {
    const form = await setupForm(api, { type: 'form', fields })
    return Object.fromEntries(
      Object.entries(getEntries(form, data)).map(([dataPath, entry]) => [
        dataPath,
        entry.node.getPropertyNode(entry)
      ])
    )
  }

  async function getFieldProperties(fields, data) {
    return Object.fromEntries(
      Object.entries(await getPropertyNodes(fields, data)).map(
        ([dataPath, node]) => [dataPath, node?.property ?? null]
      )
    )
  }

  describe('derivation by type', () => {
    it('derives text, number and boolean types', async () => {
      expect(
        await getFieldProperties({
          title: { type: 'text', trim: true, maxLength: 20 },
          email: { type: 'email' },
          body: { type: 'markup' },
          source: { type: 'code' },
          price: { type: 'number', range: [0, 100], decimals: 2 },
          pages: { type: 'integer', minimum: 1 },
          isPublic: { type: 'checkbox' },
          onSale: { type: 'switch' }
        })
      ).toEqual({
        title: { type: 'string', nullable: true, trim: true, maxLength: 20 },
        email: { type: 'string', format: 'email', nullable: true },
        body: { type: 'string', nullable: true },
        source: { type: 'string', nullable: true },
        price: { type: 'number', range: [0, 100], decimals: 2, nullable: true },
        pages: { type: 'integer', minimum: 1, nullable: true },
        isPublic: { type: 'boolean', nullable: true },
        onSale: { type: 'boolean', default: false }
      })
    })

    it('derives options types', async () => {
      const options = [{ id: 1 }, { id: 2 }]
      expect(
        await getFieldProperties({
          format: { type: 'select', options: ['lp', 'cd'] },
          genres: { type: 'checkboxes', options: ['jazz'], required: true },
          tags: { type: 'multiselect', multiple: true, options: ['a', 'b'] },
          label: { type: 'select', relate: true, options },
          artists: { type: 'checkboxes', relate: true, options }
        })
      ).toEqual({
        format: { type: 'string', enum: ['lp', 'cd'], nullable: true },
        genres: {
          type: 'array',
          items: { type: 'string', enum: ['jazz'] },
          required: true,
          minItems: 1,
          default: []
        },
        tags: {
          type: 'array',
          items: { type: 'string', enum: ['a', 'b'] },
          default: []
        },
        label: { type: 'object', relate: true, nullable: true },
        artists: {
          type: 'array',
          items: { type: 'object' },
          relate: true,
          default: []
        }
      })
    })

    it('derives date, upload and color types', async () => {
      expect(
        await getFieldProperties({
          released: { type: 'date' },
          updated: { type: 'datetime' },
          cover: { type: 'upload' },
          scans: { type: 'upload', multiple: true },
          color: { type: 'color' },
          tint: { type: 'color', colorFormat: 'rgb' }
        })
      ).toEqual({
        released: { type: 'date', nullable: true },
        updated: { type: 'datetime', nullable: true },
        cover: { type: 'asset', nullable: true },
        scans: { type: 'array', items: { type: 'asset' }, default: [] },
        color: { type: 'color', nullable: true },
        tint: { type: 'object', nullable: true }
      })
    })

    it('derives sources and nested sections, not unnested ones', async () => {
      const name = { type: 'text', required: true }
      // Sources keep the type's `exclude` callback for sources with resources:
      const exclude = expect.any(Function)
      expect(
        await getFieldProperties({
          tracks: {
            type: 'list',
            inlined: true,
            form: { type: 'form', fields: { name } }
          },
          label: {
            type: 'object',
            inlined: true,
            form: { type: 'form', fields: { name } }
          },
          vendors: {
            type: 'list',
            resource: 'vendors',
            form: { type: 'form', fields: { name } }
          },
          address: { type: 'section', nested: true, fields: { name } },
          details: { type: 'section', fields: { notes: { type: 'text' } } }
        })
      ).toEqual({
        tracks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', required: true, nullable: true }
            }
          },
          default: [],
          exclude
        },
        label: {
          type: 'object',
          properties: {
            name: { type: 'string', required: true, nullable: true }
          },
          nullable: true,
          exclude
        },
        vendors: { type: 'array', default: [], exclude },
        address: {
          type: 'object',
          properties: {
            name: { type: 'string', required: true, nullable: true }
          },
          default: {}
        },
        notes: { type: 'string', nullable: true }
      })
    })
  })

  describe('defaults', () => {
    it('leaves `value` fields without `default` missing', async () => {
      // Like loaded values that the server rejects as `null`, e.g. timestamps
      // that it checks for concurrent edits:
      const form = await setupForm(api, {
        type: 'form',
        fields: {
          updatedAt: { type: 'value' },
          version: { type: 'value', default: 1 }
        }
      })
      expect(initializeData(form, {})).toEqual({ version: 1 })
    })

    it('leaves values of types without `getProperty()` missing', async () => {
      defineType({ type: 'untyped' })
      const form = await setupForm(api, {
        type: 'form',
        fields: {
          note: { type: 'untyped' },
          count: { type: 'untyped', default: 0 },
          label: { type: 'untyped' }
        }
      })
      // Values without a type accept `null`:
      expect(initializeData(form, { label: null })).toEqual({
        count: 0,
        label: null
      })
    })
  })

  describe('forms that contain themselves', () => {
    it('derives the items of lists in their own forms', async () => {
      // Like nested blocks of articles, which hold articles of blocks again:
      const nested = {
        type: 'form',
        fields: { title: { type: 'text', default: 'Nested' }, blocks: null }
      }
      const text = { type: 'form', fields: { text: { type: 'text' } } }
      const blocks = { type: 'list', forms: { nested, text } }
      nested.fields.blocks = blocks
      const form = await setupForm(api, { type: 'form', fields: { blocks } })
      expect(
        initializeData(form, { blocks: [{ type: 'nested', blocks: null }] })
      ).toEqual({
        blocks: [{ type: 'nested', title: 'Nested', blocks: [] }]
      })
    })
  })

  describe('callbacks', () => {
    it('keeps callbacks of keywords and resolves them per entry', async () => {
      const contexts = []
      const required = context => {
        contexts.push(context)
        return context.item.isPublic
      }
      const field = { type: 'text', required, maxLength: () => 3 }
      const form = await setupForm(api, {
        type: 'form',
        fields: { isPublic: { type: 'switch' }, title: field }
      })
      const getErrors = data => {
        const entry = getEntries(form, data).title
        return entry.node.getPropertyNode(entry).getValidationErrors(entry)
      }
      expect(getErrors({ isPublic: false, title: null })).toEqual([])
      expect(getErrors({ isPublic: true, title: null })).toEqual([
        { message: 'is required' }
      ])
      expect(getErrors({ isPublic: false, title: 'Long' })).toEqual([
        { message: 'must be at most 3 characters long' }
      ])
      // Callbacks get the context of their field, as when rendered:
      expect(contexts[0].schema).toBe(form.fields.title)
      expect(contexts[0].dataPath).toBe('title')
      expect(contexts[0].value).toBe(null)
    })

    it('derives the shape per entry when callbacks decide it', async () => {
      const form = await setupForm(api, {
        type: 'form',
        fields: {
          many: { type: 'switch' },
          formats: {
            type: 'select',
            options: ['lp', 'cd'],
            multiple: ({ item }) => item.many
          }
        }
      })
      const getNode = data => {
        const entry = getEntries(form, data).formats
        return entry.node.getPropertyNode(entry)
      }
      expect(getNode({ many: false }).property).toEqual({
        type: 'string',
        enum: ['lp', 'cd'],
        nullable: true
      })
      expect(getNode({ many: true }).property).toEqual({
        type: 'array',
        items: { type: 'string', enum: ['lp', 'cd'] },
        default: []
      })
      expect(getNode({ many: true })).not.toBe(getNode({ many: true }))
    })
    it('detects the callbacks that types read to derive it', async () => {
      defineType({
        type: 'test-measure',
        component: {},
        getProperty: ({ unit }) => ({
          type: unit === 'pieces' ? 'integer' : 'number'
        })
      })
      const unit = vi.fn(({ item }) => item.unit)
      const form = await setupForm(api, {
        type: 'form',
        fields: {
          unit: { type: 'text' },
          amount: { type: 'test-measure', unit }
        }
      })
      const getProperty = data => {
        const entry = getEntries(form, data).amount
        return entry.node.getPropertyNode(entry).property
      }
      expect(getProperty({ unit: 'pieces' })).toEqual({
        type: 'integer',
        nullable: true
      })
      expect(getProperty({ unit: 'kg' })).toEqual({
        type: 'number',
        nullable: true
      })
      // The callback is only called with the contexts of entries:
      expect(unit.mock.calls.map(([{ item }]) => item.unit)).toEqual([
        'pieces',
        'kg'
      ])
    })
  })

  describe('types', () => {
    it('adds the validations of the type per entry', async () => {
      const form = await setupForm(api, {
        type: 'form',
        fields: {
          site: { type: 'domain' },
          count: { type: 'number', step: 1 }
        }
      })
      const entries = getEntries(form, { site: 'example', count: 1.5 })
      const getErrors = name => {
        const entry = entries[name]
        return entry.node.getPropertyNode(entry).getValidationErrors(entry)
      }
      // Properties have no keywords for these:
      expect(getErrors('site')).toEqual([{ message: 'is not a domain' }])
      expect(getErrors('count')).toEqual([
        { message: 'must be a whole number' }
      ])
    })

    it('converts values with the data type and the hooks', async () => {
      const serializeValue = vi.fn(({ value }) => value)
      const fields = {
        released: { type: 'date' },
        title: { type: 'text', trim: true, required: true },
        label: { type: 'select', relate: true, options: [], serializeValue },
        cover: { type: 'upload' },
        scans: { type: 'upload', multiple: true }
      }
      const data = {
        released: new Date(2026, 9, 23),
        title: '  ',
        label: { id: 1, name: 'Blue Note' },
        cover: { name: 'a', upload: { success: true } },
        scans: [{ name: 'b' }, { name: 'c', upload: { success: false } }]
      }
      const form = await setupForm(api, { type: 'form', fields })
      const entries = getEntries(form, data)
      const serialize = name => {
        const entry = entries[name]
        return entry.node
          .getPropertyNode(entry)
          .serialize(entry.data[name], entry)
      }
      expect(serialize('released')).toBe('2026-10-23')
      // Empty text that's required is sent as `null`, like the fields do:
      expect(serialize('title')).toBe(null)
      expect(serialize('label')).toEqual({ id: 1 })
      // The field's hook runs after the type's conversion:
      expect(serializeValue.mock.calls[0][0].value).toEqual({ id: 1 })
      expect(serializeValue.mock.calls[0][0].schema).toBe(form.fields.label)
      expect(serialize('cover')).toEqual({ name: 'a' })
      expect(serialize('scans')).toEqual([{ name: 'b' }])
      const entry = entries.released
      expect(
        entry.node.getPropertyNode(entry).deserialize('2026-10-23', entry)
      ).toEqual(new Date(2026, 9, 23))
    })

    it('derives the hooks of types without their own property', async () => {
      defineType({
        type: 'test-rating',
        component: {},
        defaultValue: 0,
        getValidations: () => ({ integer: true }),
        serializeValue: ({ value }) => value * 2,
        deserializeValue: ({ value }) => value / 2,
        getDisplayValue: ({ value }) => `${value} stars`
      })
      const form = await setupForm(api, {
        type: 'form',
        fields: { rating: { type: 'test-rating', required: true } }
      })
      const entry = getEntries(form, { rating: 1.5 }).rating
      const node = entry.node.getPropertyNode(entry)
      expect(node.property).toEqual({ required: true, default: 0 })
      expect(node.getValidationErrors(entry)).toEqual([
        { message: 'must be a whole number' }
      ])
      expect(node.serialize(2, entry)).toBe(4)
      expect(node.deserialize(4, entry)).toBe(2)
      expect(node.getDisplayValue(entry)).toBe('1.5 stars')
    })

    it('derives no property for types without a value', async () => {
      expect(
        await getFieldProperties({
          save: { type: 'button' },
          gap: { type: 'spacer' },
          note: { type: 'label' }
        })
      ).toEqual({
        save: null,
        gap: null,
        // Labels hold `null`, which isn't sent:
        note: { exclude: true }
      })
    })
  })

  describe('fields of the same name', () => {
    it('merges the keywords of the first field that defines each', async () => {
      const serializeValue = ({ value }) => value
      const minLength = () => 2
      const nodes = await getPropertyNodes({
        name: { type: 'text', maxLength: 10 },
        details: {
          type: 'section',
          fields: {
            name: { type: 'text', minLength, maxLength: 5, serializeValue }
          }
        }
      })
      expect(nodes.name.property).toEqual({
        type: 'string',
        nullable: true,
        maxLength: 10,
        minLength,
        serializeValue
      })
    })

    it('merges the keywords that the settings of fields leave out', async () => {
      const form = await setupForm(api, {
        type: 'form',
        fields: {
          title: { type: 'text' },
          details: {
            type: 'section',
            fields: { title: { type: 'text', nullable: false } }
          }
        }
      })
      const { title } = getEntries(form)
      expect(title.node.getPropertyNode(title).property).toEqual({
        type: 'string',
        default: ''
      })
      expect(initializeData(form, { title: null })).toEqual({ title: '' })
    })

    it('merges `minItems` with the `required` that derives it', async () => {
      const options = ['a']
      const nodes = await getPropertyNodes({
        tags: { type: 'checkboxes', options, required: false },
        details: {
          type: 'section',
          fields: { tags: { type: 'checkboxes', options, required: true } }
        },
        genres: { type: 'checkboxes', options, required: true },
        more: {
          type: 'section',
          fields: { genres: { type: 'checkboxes', options, minItems: 2 } }
        }
      })
      expect(nodes.tags.property).toEqual({
        type: 'array',
        items: { type: 'string', enum: ['a'] },
        default: []
      })
      expect(nodes.genres.property).toEqual({
        type: 'array',
        items: { type: 'string', enum: ['a'] },
        required: true,
        minItems: 2,
        default: []
      })
    })

    it('resolves callbacks with the field that they came from', async () => {
      const minLength = vi.fn(() => 2)
      const form = await setupForm(api, {
        type: 'form',
        fields: {
          name: { type: 'text', maxLength: 10 },
          details: {
            type: 'section',
            fields: { name: { type: 'text', minLength } }
          }
        }
      })
      const entry = getEntries(form, { name: 'a' }).name
      expect(
        entry.node.getPropertyNode(entry).getValidationErrors(entry)
      ).toEqual([{ message: 'must be at least 2 characters long' }])
      expect(minLength.mock.calls[0][0].schema).toBe(
        form.fields.details.fields.name
      )
    })

    it('merges only the relevant fields when relevance varies', async () => {
      const form = await setupForm(api, {
        type: 'form',
        fields: {
          isLong: { type: 'switch' },
          name: { type: 'text', maxLength: 10 },
          details: {
            type: 'section',
            if: ({ item }) => item.isLong,
            fields: { name: { type: 'text', minLength: 5 } }
          }
        }
      })
      const getProperty = data => {
        const entry = getEntries(form, data).name
        return entry.node.getRelevantNode(entry).getPropertyNode(entry).property
      }
      expect(getProperty({ isLong: true })).toEqual({
        type: 'string',
        nullable: true,
        maxLength: 10,
        minLength: 5
      })
      expect(getProperty({ isLong: false })).toEqual({
        type: 'string',
        nullable: true,
        maxLength: 10
      })
    })
  })

  describe('cache', () => {
    it('reuses the nodes of fields and of merged fields', async () => {
      const form = await setupForm(api, {
        type: 'form',
        fields: {
          title: { type: 'text' },
          name: { type: 'text' },
          details: { type: 'section', fields: { name: { type: 'text' } } }
        }
      })
      const getNodes = data => {
        const { title, name } = getEntries(form, data)
        return [
          title.node.getPropertyNode(title),
          name.node.getPropertyNode(name)
        ]
      }
      const [title, name] = getNodes({ title: 'a' })
      expect(getNodes({ title: 'b' })).toEqual([title, name])
      expect(getNodes({ title: 'b' })[0]).toBe(title)
      expect(getNodes({ title: 'b' })[1]).toBe(name)
    })

    it('derives the properties again once setup changes the fields', async () => {
      const api = { defaults: { text: { maxLength: 5 } } }
      const form = reactive({
        type: 'form',
        fields: { title: { type: 'text' } }
      })
      const getProperty = () => {
        const { title } = getEntries(form)
        return title.node.getPropertyNode(title).property
      }
      expect(getProperty()).toEqual({ type: 'string', nullable: true })
      await setupForm(api, form)
      expect(getProperty()).toEqual({
        type: 'string',
        nullable: true,
        maxLength: 5
      })
    })
  })
})
