import { hyphenate } from '@ditojs/utils'
import { Model, ValidationError } from '@ditojs/server'
import '../../packages/admin/src/types/index.js'
import SchemaContext from '../../packages/admin/src/SchemaContext.js'
import { setupForm } from '../../packages/admin/src/utils/schema/setup.js'
import { getFormProperties } from '../../packages/admin/src/utils/schema/properties.js'
import { getDataValidationErrors } from '../../packages/admin/src/utils/schema/validation.js'
import { createTestApp } from '../utils/app.ts'

// The properties that the admin derives from the fields of every type with a
// value, validated by the server's real `Validator`, which compiles schemas in
// strict mode and rejects keywords and formats that it doesn't know:
const fields = {
  title: { type: 'text', required: true, maxLength: 20 },
  code: { type: 'text', minLength: 3, pattern: '^[A-Z]+$' },
  email: { type: 'email' },
  website: { type: 'url' },
  host: { type: 'hostname' },
  domain: { type: 'domain' },
  phone: { type: 'tel' },
  password: { type: 'password' },
  card: { type: 'creditcard' },
  body: { type: 'textarea', nullable: false },
  html: { type: 'markup' },
  source: { type: 'code' },
  price: { type: 'number', minimum: 0, decimals: 2 },
  pages: { type: 'integer', maximum: 1000 },
  rating: { type: 'slider', range: [0, 5] },
  done: { type: 'progress' },
  isPublic: { type: 'checkbox', nullable: false },
  isActive: { type: 'switch' },
  isAnswered: { type: 'checkbox' },
  day: { type: 'date' },
  opensAt: { type: 'datetime' },
  opensAtTime: { type: 'time' },
  background: { type: 'color' },
  tint: { type: 'color', colorFormat: 'rgb' },
  format: { type: 'select', options: ['hardcover', 'paperback'] },
  genre: { type: 'radio', options: { data: [{ value: 'jazz' }] } },
  genres: { type: 'checkboxes', options: ['jazz', 'rock'], required: true },
  keywords: { type: 'multiselect', multiple: true, taggable: true },
  translator: {
    type: 'select',
    options: { data: async () => [], value: 'id' }
  },
  author: { type: 'select', relate: true, options: { data: async () => [] } },
  editors: {
    type: 'multiselect',
    multiple: true,
    relate: true,
    options: { data: async () => [] }
  },
  image: { type: 'upload' },
  images: { type: 'upload', multiple: true },
  total: { type: 'value' },
  details: {
    type: 'section',
    fields: { subtitle: { type: 'text', maxLength: 40 } }
  },
  address: {
    type: 'section',
    nested: true,
    fields: { street: { type: 'text', required: true } }
  },
  publisher: {
    type: 'object',
    form: {
      type: 'form',
      fields: { name: { type: 'text' }, founded: { type: 'integer' } }
    }
  },
  chapters: {
    type: 'list',
    required: true,
    maxItems: 3,
    form: {
      type: 'form',
      fields: { heading: { type: 'text', required: true } }
    }
  },
  prices: {
    type: 'list',
    wrapPrimitives: 'price',
    form: {
      type: 'form',
      fields: { price: { type: 'number', minimum: 0 } }
    }
  },
  blocks: {
    type: 'list',
    forms: {
      text: { type: 'form', fields: { text: { type: 'markup' } } },
      spacer: { type: 'form', fields: { height: { type: 'integer' } } }
    }
  },
  parts: {
    type: 'tree-list',
    form: { type: 'form', fields: { name: { type: 'text', required: true } } },
    children: {
      name: 'sections',
      form: { type: 'form', fields: { name: { type: 'text' } } }
    }
  },
  reviews: {
    type: 'list',
    resource: 'reviews',
    form: { type: 'form', fields: { text: { type: 'text' } } }
  }
}

describe('The properties of fields on the server', async () => {
  const api = { defaults: {}, normalizePath: hyphenate }
  const form = await setupForm(api, { type: 'form', fields })
  const properties = getFormProperties(
    form,
    SchemaContext.createForSchema(null, {
      schema: form,
      data: {},
      dataPath: ''
    })
  )

  class Entry extends Model {
    static properties = properties
  }

  // The app sets up the model with its validator:
  const app = createTestApp({ models: { Entry } })

  afterAll(() => app.knex.destroy())

  const file = {
    key: 'a1b2.png',
    name: 'photo.png',
    type: 'image/png',
    size: 1024,
    url: 'https://example.com/a1b2.png',
    width: 640,
    height: 480
  }

  const valid = {
    title: 'Opening',
    code: 'ABC',
    email: 'ada@example.com',
    website: 'https://example.com',
    host: 'example.com',
    password: 'secret',
    price: 12.5,
    pages: 320,
    rating: 4,
    done: 50,
    isPublic: true,
    isActive: false,
    isAnswered: null,
    day: '2026-05-14',
    opensAt: '2026-05-14T12:30:00.000Z',
    opensAtTime: '2026-05-14T14:30:00.000Z',
    background: '#ff8000',
    tint: { r: 255, g: 128, b: 0, a: 1 },
    format: 'paperback',
    genre: 'jazz',
    genres: ['rock'],
    keywords: ['classic', 'gothic'],
    translator: 7,
    author: { id: 1 },
    editors: [{ id: 2 }, { id: 3 }],
    image: file,
    images: [file],
    total: 3,
    subtitle: 'A Novel',
    address: { street: 'Main Street' },
    publisher: { name: 'Penguin', founded: 1935 },
    chapters: [{ heading: 'Beginnings' }],
    prices: [10, 12.5],
    blocks: [
      { type: 'text', text: '<p>Once</p>' },
      { type: 'spacer', height: 20 }
    ],
    parts: [
      { name: 'One', sections: [{ name: 'First' }] },
      { name: 'Two', sections: [] }
    ]
  }

  // The data paths of the errors of both sides:
  const getServerErrors = values => {
    try {
      Entry.fromJson({ ...valid, ...values })
      return []
    } catch (err) {
      if (err instanceof ValidationError) {
        return Object.keys(err.data.errors).sort()
      } else {
        throw err
      }
    }
  }

  const getAdminErrors = values =>
    Object.keys(
      getDataValidationErrors(form, { ...valid, ...values }) ?? {}
    ).sort()

  it('compiles the derived properties and accepts valid values', () => {
    expect(() => Entry.fromJson(valid)).not.toThrow()
    expect(getAdminErrors({})).toEqual([])
  })

  it('accepts the empty values of the fields on both sides', () => {
    const empty = {
      code: null,
      phone: null,
      body: '',
      price: null,
      isPublic: false,
      isAnswered: null,
      day: null,
      background: null,
      tint: null,
      format: null,
      genre: null,
      keywords: [],
      translator: null,
      author: null,
      editors: [],
      image: null,
      images: [],
      total: null,
      subtitle: null,
      publisher: null,
      prices: [],
      blocks: [],
      parts: []
    }
    expect(getServerErrors(empty)).toEqual([])
    expect(getAdminErrors(empty)).toEqual([])
  })

  // Where both sides differ: the server applies formats to `''`, as JSON Schema
  // does, while the admin skips empty values. Emptied fields send `null`:
  it('rejects empty strings with formats only on the server', () => {
    const empty = { email: '', website: '', host: '', background: '' }
    expect(getServerErrors(empty)).toEqual(Object.keys(empty).sort())
    expect(getAdminErrors(empty)).toEqual([])
  })

  // The `enum` of static options is the server's to check:
  it('rejects values missing from static options only on the server', () => {
    const missing = { format: 'scroll', genre: 'blues', genres: ['pop'] }
    expect(getServerErrors(missing)).toEqual(['format', 'genre', 'genres/0'])
    expect(getAdminErrors(missing)).toEqual([])
  })

  it('rejects the same invalid values on both sides', () => {
    const invalid = {
      title: '',
      code: 'AB',
      email: 'ada',
      website: 'example.com',
      price: -1,
      pages: 1001,
      rating: 6,
      genres: [],
      subtitle: 'A'.repeat(41),
      address: { street: '' },
      publisher: { name: 'Penguin', founded: 'long ago' },
      chapters: [{ heading: '' }],
      prices: [-1],
      blocks: [{ type: 'spacer', height: 'tall' }],
      parts: [{ name: '', sections: [] }]
    }
    // The errors of nested values are reported at their own data paths:
    const nestedDataPaths = {
      address: 'address/street',
      publisher: 'publisher/founded',
      chapters: 'chapters/0/heading',
      prices: 'prices/0',
      blocks: 'blocks/0/height',
      parts: 'parts/0/name'
    }
    const dataPaths = [
      ...Object.keys(invalid).filter(key => !nestedDataPaths[key]),
      ...Object.values(nestedDataPaths)
    ].sort()
    expect(getServerErrors(invalid)).toEqual(dataPaths)
    expect(getAdminErrors(invalid)).toEqual(dataPaths)
  })
})
