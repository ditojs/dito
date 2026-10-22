import { hyphenate } from '@ditojs/utils'
import '../../types/index.js'
import SchemaContext from '../../SchemaContext.js'
import { setupForm } from './setup.js'
import { getFormProperties, checkProperties } from './properties.js'
import {
  initializeData,
  serializeData,
  deserializeData,
  isDataPathExcluded
} from './data.js'
import { getDataValidationErrors } from './validation.js'
import { mergeData } from '../mergeData.ts'
import { toClipboard } from '../toClipboard.ts'
import { fromClipboard } from '../fromClipboard.ts'

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
          pattern: '^[A-Z]+$'
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
          opensAtTime: { type: 'time', format: { time: 'short' } }
        })
      ).toEqual({
        day: { type: 'date', required: true },
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
        genre: { type: 'string', enum: ['jazz', 'rock'], required: true },
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

    it('skips components without a value', async () => {
      expect(
        await getProperties({ rating: { type: 'component', component } })
      ).toEqual({})
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
        title: { type: 'string', required: true }
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
        author: { ...item, required: true }
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
        price: { type: 'number', range: () => [0, 10] }
      })
    ).toEqual({
      title: { type: 'string', nullable: true },
      price: { type: 'number', nullable: true }
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

    it('leaves out irrelevant values in validation, defaults and data', () => {
      const data = initialize(properties, { isFeatured: false })
      expect(data).toEqual({ isFeatured: false })
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

    it('sends the stored files of assets', () => {
      const properties = {
        image: { type: 'asset' },
        pending: { type: 'asset' }
      }
      expect(
        serialize(properties, {
          image: { key: 'a', name: 'a.png', upload: { success: true } },
          pending: { name: 'b.png', upload: { success: false } }
        })
      ).toEqual({ image: { key: 'a', name: 'a.png' }, pending: null })
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
        images: [
          { key: 'a', name: 'a.png' },
          { name: 'b.png', upload: { success: false } }
        ]
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
