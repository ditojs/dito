import { hyphenate } from '@ditojs/utils'
import '../../types/index.js'
import SchemaContext from '../../SchemaContext.js'
import { setupForm } from './setup.js'
import { getFormProperties } from './properties.js'

async function getProperties(fields, schema = {}) {
  const api = { defaults: {}, normalizePath: hyphenate }
  const form = await setupForm(api, { type: 'form', fields, ...schema })
  const context = SchemaContext.createForSchema(null, {
    schema: form,
    data: {},
    dataPath: ''
  })
  return getFormProperties(form, context)
}

describe('getFormProperties()', () => {
  describe('text types', () => {
    it('describes strings that are empty as empty strings', async () => {
      expect(
        await getProperties({
          title: { type: 'text' },
          body: { type: 'textarea' },
          html: { type: 'markup' },
          source: { type: 'code' },
          phone: { type: 'tel' }
        })
      ).toEqual({
        title: { type: 'string', default: '' },
        body: { type: 'string', default: '' },
        html: { type: 'string', default: '' },
        source: { type: 'string', default: '' },
        phone: { type: 'string', default: '' }
      })
    })

    it('describes `nullable` strings without a default', async () => {
      expect(
        await getProperties({ title: { type: 'text', nullable: true } })
      ).toEqual({
        title: { type: 'string', nullable: true }
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
        email: { type: 'string', format: 'email', default: '' },
        website: { type: 'string', format: 'uri', default: '' },
        host: { type: 'string', format: 'hostname', default: '' },
        // Passwords that aren't entered are left unchanged:
        password: { type: 'string', format: 'password' }
      })
    })

    it('leaves out the formats that the server lacks', async () => {
      expect(
        await getProperties({
          domain: { type: 'domain' },
          card: { type: 'creditcard' }
        })
      ).toEqual({
        domain: { type: 'string', default: '' },
        card: { type: 'string', default: '' }
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
          default: ''
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

    it('leaves out `decimals`, which the server lacks', async () => {
      expect(
        await getProperties({ price: { type: 'number', decimals: 2 } })
      ).toEqual({
        price: { type: 'number', nullable: true }
      })
    })
  })

  describe('boolean types', () => {
    it('describes booleans that are empty as `false`', async () => {
      expect(
        await getProperties({
          isPublic: { type: 'checkbox' },
          isActive: { type: 'switch', default: true },
          isAnswered: { type: 'checkbox', nullable: true }
        })
      ).toEqual({
        isPublic: { type: 'boolean', default: false },
        isActive: { type: 'boolean', default: true },
        isAnswered: { type: 'boolean', nullable: true }
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
          overlay: { type: 'color', format: 'hex8', default: '#ff000080' },
          tint: { type: 'color', format: 'rgb' }
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
      title: { type: 'string' },
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
      title: { type: 'string', default: '' },
      note: { type: 'string', default: '' }
    })
  })

  it('skips fields without a description of their data yet', async () => {
    expect(
      await getProperties({
        title: { type: 'text' },
        heading: { type: 'label' },
        save: { type: 'button' },
        tags: { type: 'list', form: { type: 'form', fields: {} } }
      })
    ).toEqual({
      title: { type: 'string', default: '' }
    })
  })
})
