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
        genre: { type: 'select', options: ['jazz', 'rock'] },
        tags: { type: 'list', form: { type: 'form', fields: {} } }
      })
    ).toEqual({
      title: { type: 'string', default: '' }
    })
  })
})
