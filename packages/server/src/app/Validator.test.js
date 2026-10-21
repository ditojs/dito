import { vi } from 'vitest'
import * as objection from 'objection'
import { Validator } from './Validator.js'
import { convertSchema } from '../schema/index.js'

describe('Validator.getKeyword()', () => {
  it('finds keywords registered with a leading underscore', () => {
    const validator = new Validator()
    expect(validator.getKeyword('instanceof')).toBe(
      validator.keywords._instanceof
    )
  })

  it('applies silent and message of underscore-prefixed keywords', () => {
    const validator = new Validator({
      keywords: {
        _quiet: { silent: true },
        _loud: { message: 'is too loud' }
      }
    })
    const errors = validator.parseErrors([
      { instancePath: '/a', keyword: 'quiet', message: 'quiet', params: {} },
      { instancePath: '/b', keyword: 'loud', message: 'loud', params: {} }
    ])
    expect(errors).toEqual({
      b: [{ message: 'is too loud', keyword: 'loud', params: {} }]
    })
  })
})

describe('Validator.getFormat()', () => {
  it('applies the message of underscore-prefixed formats', () => {
    const validator = new Validator({
      formats: { _even: { message: 'needs to be even' } }
    })
    const errors = validator.parseErrors([
      {
        instancePath: '/a',
        keyword: 'format',
        message: 'must match format "even"',
        params: { format: 'even' }
      }
    ])
    expect(errors).toEqual({
      a: [
        {
          message: 'needs to be even',
          keyword: 'format',
          params: { format: 'even' }
        }
      ]
    })
  })
})

describe('color type', () => {
  const validator = new Validator()
  const validate = validator.compile(
    { type: 'object', properties: { color: { $ref: 'color' } } },
    { throw: false }
  )

  it.each([
    '#f80',
    '#f80c',
    '#ff8800',
    '#ff8800cc'
  ])('accepts %j, as stored by the admin color type', color => {
    expect(validate({ color })).toBe(true)
  })

  it.each([
    '#12',
    '#ff880',
    'ff8800',
    'red',
    'transparent',
    'light red',
    'rgb(0, 0, 0)',
    '',
    { r: 255, g: 136, b: 0, a: 1 },
    { h: 32, s: 1, l: 0.5 },
    255
  ])('rejects %j', color => {
    expect(validate({ color })).toBe(false)
  })
})

describe('formats', () => {
  const validator = new Validator()
  const compile = schema => validator.compile(schema, { throw: false })

  describe.each([
    ['email', 'ada@example.com', 'ada'],
    ['uri', 'https://example.com', 'example.com'],
    ['date-time', '2026-10-21T12:00:00Z', '2026-10-21'],
    ['color', '#f80', 'orange']
  ])('%s', (format, valid, invalid) => {
    const validate = compile({ type: 'string', format })

    it('accepts valid values', () => {
      expect(validate(valid)).toBe(true)
    })

    it('rejects invalid values and empty strings', () => {
      expect(validate(invalid)).toBe(false)
      expect(validate('')).toBe(false)
    })
  })

  it('rejects empty strings with patterns of Dito.js schemas', () => {
    const validate = compile(
      convertSchema({ type: 'string', pattern: '^\\d+$' })
    )
    expect(validate('12')).toBe(true)
    expect(validate('')).toBe(false)
    expect(validator.parseErrors(validate.errors)).toEqual({
      '': [
        {
          message: 'must match pattern "^\\d+$"',
          keyword: 'pattern',
          params: { pattern: '^\\d+$' }
        }
      ]
    })
  })
})

describe('Validator.compile()', () => {
  const schema = {
    type: 'object',
    properties: { pages: { type: 'integer' } }
  }

  it('throws validation errors for sync validators by default', () => {
    const validate = new Validator().compile(schema)
    expect(validate({ pages: 12 })).toBe(true)
    expect(() => validate({ pages: 'many' })).toThrow('validation failed')
  })

  it('rejects with validation errors for async validators by default', async () => {
    const validate = new Validator().compile(schema, { async: true })
    await expect(validate({ pages: 'many' })).rejects.toMatchObject({
      errors: [{ instancePath: '/pages', keyword: 'type' }]
    })
  })

  it('reports errors of async validators without throwing', async () => {
    const validate = new Validator().compile(schema, {
      async: true,
      throw: false
    })
    expect(await validate({ pages: 12 })).toEqual({ pages: 12 })
    expect(await validate({ pages: 'many' })).toBe(false)
    expect(validate.errors).toMatchObject([
      { instancePath: '/pages', keyword: 'type' }
    ])
  })

  it('rethrows errors of async validators that are not validation errors', async () => {
    const validator = new Validator({
      keywords: {
        checkShelf: {
          async: true,
          async validate() {
            throw new Error('Shelf is unreachable')
          }
        }
      }
    })
    const validate = validator.compile(
      { type: 'object', checkShelf: true },
      { async: true, throw: false }
    )
    await expect(validate({})).rejects.toThrow('Shelf is unreachable')
  })

  it('removes async keywords from sync validators', () => {
    const validateShelf = vi.fn(async () => false)
    const validator = new Validator({
      keywords: {
        checkShelf: { async: true, validate: validateShelf }
      }
    })
    const validate = validator.compile(
      { type: 'object', checkShelf: true },
      { throw: false }
    )
    expect(validate({})).toBe(true)
    expect(validateShelf).not.toHaveBeenCalled()
  })

  it('rejects unknown keywords', () => {
    const validator = new Validator()
    expect(() =>
      validator.compile({
        type: 'object',
        properties: {
          tags: { type: 'array', item: { type: 'string' } }
        }
      })
    ).toThrow('strict mode: unknown keyword: "item"')
  })

  it('accepts unknown keywords when `strictSchema` is disabled', () => {
    const validator = new Validator({ options: { strictSchema: false } })
    const validate = validator.compile(
      { type: 'array', item: { type: 'string' } },
      { throw: false }
    )
    expect(validate([1])).toBe(true)
  })

  it('skips disabled keywords, formats and types', () => {
    const validator = new Validator({
      keywords: { range: null },
      formats: { color: null },
      types: { color: null }
    })
    // Ajv doesn't know disabled keywords and formats:
    expect(() =>
      validator.compile({ type: 'integer', range: [1, 10] })
    ).toThrow('strict mode: unknown keyword: "range"')
    expect(() =>
      validator.compile({ type: 'string', format: 'color' })
    ).toThrow('unknown format "color"')
    expect(validator.getAjv().getSchema('color')).toBeUndefined()
  })

  it('reuses Ajv instances for options that only differ in defaults', () => {
    const validator = new Validator()
    expect(validator.getAjv({ patch: false, async: false })).toBe(
      validator.getAjv()
    )
    expect(validator.getAjv({ patch: true })).not.toBe(validator.getAjv())
  })
})

describe('Validator.addSchema()', () => {
  it('adds schemas to the already created Ajv instances', () => {
    const validator = new Validator()
    const ajv = validator.getAjv({ async: true })
    validator.addSchema({
      $id: 'Book',
      type: 'object',
      properties: { title: { type: 'string' } },
      definitions: { Chapter: { type: 'object' } }
    })
    const schema = ajv.getSchema('Book').schema
    expect(schema.$async).toBe(true)
    expect(schema.definitions.Chapter.$async).toBe(true)
  })
})

describe('Validator.processSchema()', () => {
  it('removes required keywords and formats for patch validation', () => {
    const validator = new Validator()
    const schema = validator.processSchema(
      {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', format: 'required' },
          email: { type: 'string', format: 'email' }
        }
      },
      { patch: true }
    )
    expect(schema).toEqual({
      type: 'object',
      properties: {
        title: { type: 'string' },
        email: { type: 'string', format: 'email' }
      }
    })
  })

  it('keeps the tag of discriminators required for patch validation', () => {
    const validator = new Validator()
    const schema = validator.processSchema(
      {
        discriminator: { propertyName: 'type' },
        required: ['type', 'title'],
        oneOf: [{ properties: { type: { const: 'book' } } }]
      },
      { patch: true }
    )
    expect(schema.required).toEqual(['type'])
  })

  it('converts async `validate()` keywords to `validateAsync()`', () => {
    const validate = async () => true
    const schema = new Validator().processSchema(
      { type: 'object', validate },
      { async: true }
    )
    expect(schema).toEqual({
      type: 'object',
      validateAsync: validate,
      $async: true
    })
  })
})

describe('Validator.parseErrors()', () => {
  const validator = new Validator()

  it('removes the errors of `if`, but not of its `else` branch', () => {
    expect(
      validator.parseErrors([
        {
          instancePath: '/cover/size',
          keyword: 'type',
          message: 'must be integer',
          params: { type: 'integer' }
        },
        {
          instancePath: '/cover',
          keyword: 'if',
          message: 'must match "else" schema',
          params: { failingKeyword: 'else' }
        }
      ])
    ).toEqual({
      'cover/size': [
        {
          message: 'must be integer',
          keyword: 'type',
          params: { type: 'integer' }
        }
      ]
    })
  })

  it('takes the messages of standard keywords from @ditojs/schema', () => {
    const validate = validator.compile(
      {
        type: 'object',
        properties: {
          pages: { type: 'integer' },
          rating: { type: 'number', range: [1, 5] },
          title: { type: 'string', minLength: 3 },
          tags: { type: 'array', maxItems: 1 },
          kind: { type: 'string', enum: ['novel', 'poem'] },
          color: { type: 'string', format: 'color' }
        },
        required: ['isbn']
      },
      { throw: false }
    )
    const data = {
      pages: 1.5,
      rating: 6,
      title: 'ab',
      tags: ['a', 'b'],
      kind: 'essay',
      color: 'red'
    }
    expect(validate(data)).toBe(false)
    const errors = validator.parseErrors(validate.errors)
    expect(
      Object.fromEntries(
        Object.entries(errors).map(([key, errors]) => [
          key,
          errors.map(({ message }) => message)
        ])
      )
    ).toEqual({
      '': [`must have required property 'isbn'`],
      'pages': ['must be a whole number'],
      'rating': ['must be 5 or less'],
      'title': ['must be at least 3 characters long'],
      'tags': ['must contain at most one item'],
      'kind': ['must be one of the allowed values'],
      'color': ['must be a hex color']
    })
  })

  it('supports `dataPath`, missing paths and prefixes', () => {
    expect(
      validator.parseErrors(
        [
          { dataPath: '/title', keyword: 'type', message: 'a', params: {} },
          { keyword: 'required', message: 'b', params: {} },
          {
            instancePath: `['unknown']`,
            keyword: 'additionalProperties',
            message: 'c',
            params: {}
          }
        ],
        { dataPath: '/book' }
      )
    ).toEqual({
      'book/title': [{ message: 'a', keyword: 'type', params: {} }],
      'book': [{ message: 'b', keyword: 'required', params: {} }],
      'book/unknown': [
        { message: 'c', keyword: 'additionalProperties', params: {} }
      ]
    })
  })

  it('keeps property names that look like data paths', () => {
    const errors = ['/a.b', '/[0]', '/..', '/'].map(instancePath => ({
      instancePath,
      keyword: 'type',
      message: 'x'
    }))
    expect(Object.keys(validator.parseErrors(errors))).toEqual([
      'a.b',
      '[0]',
      '..',
      ''
    ])
    expect(
      Object.keys(validator.parseErrors(errors, { dataPath: '[1].pets[0]' }))
    ).toEqual(['1/pets/0/a.b', '1/pets/0/[0]', '1/pets/0/..', '1/pets/0/'])
  })

  it('filters out duplicate errors and `$` keywords', () => {
    const error = { instancePath: '/a', keyword: 'type', message: 'x' }
    expect(
      validator.parseErrors([
        error,
        { ...error },
        { instancePath: '/a', keyword: '$merge', message: 'y' }
      ])
    ).toEqual({ a: [{ message: 'x', keyword: 'type', params: undefined }] })
  })
})

describe('Validator.prefixInstancePaths()', () => {
  it('prefixes instance paths, also empty ones', () => {
    expect(
      new Validator().prefixInstancePaths(
        [{ instancePath: '/title' }, { instancePath: '' }],
        '/books/0'
      )
    ).toEqual([
      { instancePath: '/books/0/title' },
      { instancePath: '/books/0' }
    ])
  })
})

describe('Validator model validation', () => {
  function createValidator() {
    const validator = new Validator()
    validator.app = {}
    validator.addSchema({
      $id: 'Book',
      type: 'object',
      properties: {
        title: { type: 'string' },
        details: {
          type: 'object',
          allOf: [
            { type: 'object' },
            { properties: { edition: { default: 1 } } }
          ]
        }
      }
    })
    return validator
  }

  function createModel(jsonSchema, methods = {}) {
    const modelClass = {
      getJsonSchema: () => jsonSchema,
      createValidationError: ({ errors }) =>
        Object.assign(new Error('Invalid book'), { errors })
    }
    return Object.assign(Object.create({ constructor: modelClass }), methods)
  }

  it('passes the json schema to `$beforeValidate()` and uses its result', () => {
    const validator = createValidator()
    const jsonSchema = validator.schemas[0]
    const replaced = { ...jsonSchema, $id: 'Book' }
    const model = createModel(jsonSchema, {
      $beforeValidate(schema, json, options) {
        // Receives a clone that it can modify.
        expect(schema).toEqual(jsonSchema)
        expect(schema).not.toBe(jsonSchema)
        expect({ json, options }).toEqual({ json: { title: 'A' }, options: {} })
        return replaced
      }
    })
    const ctx = {}
    validator.beforeValidate({ json: { title: 'A' }, model, ctx, options: {} })
    expect(ctx).toMatchObject({ validator, jsonSchema: replaced, options: {} })
  })

  it('keeps the json schema when `$beforeValidate()` returns nothing', () => {
    const validator = createValidator()
    const jsonSchema = validator.schemas[0]
    const beforeValidate = vi.fn(() => {})
    const model = createModel(jsonSchema, { $beforeValidate: beforeValidate })
    const ctx = {}
    validator.beforeValidate({ json: {}, model, ctx, options: {} })
    expect(beforeValidate).toHaveBeenCalled()
    // Handlers without parameters receive no clone.
    expect(ctx.jsonSchema).toBe(jsonSchema)
  })

  it('validates without mutating json with nested defaults', () => {
    const validator = createValidator()
    const jsonSchema = validator.schemas[0]
    const json = { title: 'A', details: {} }
    const result = validator.validate({
      json,
      model: createModel(jsonSchema),
      ctx: { jsonSchema },
      options: {}
    })
    expect(result).toEqual({ title: 'A', details: { edition: 1 } })
    expect(json).toEqual({ title: 'A', details: {} })
  })

  it('throws validation errors of the model', () => {
    const validator = createValidator()
    const jsonSchema = validator.schemas[0]
    expect(() =>
      validator.validate({
        json: { title: 1 },
        model: createModel(jsonSchema),
        ctx: { jsonSchema },
        options: { mutable: true }
      })
    ).toThrow('Invalid book')
  })

  it('validates asynchronously with the `async` option', async () => {
    const validator = createValidator()
    const jsonSchema = validator.schemas[0]
    const model = createModel(jsonSchema)
    const validate = json =>
      validator.validate({
        json,
        model,
        ctx: { jsonSchema },
        options: { async: true }
      })
    await expect(validate({ title: 'A' })).resolves.toMatchObject({
      title: 'A'
    })
    await expect(validate({ title: 1 })).rejects.toThrow('Invalid book')
  })

  it("doesn't call the default `$beforeValidate()` of objection", () => {
    const validator = createValidator()
    const jsonSchema = validator.schemas[0]
    const $beforeValidate = vi.spyOn(
      objection.Model.prototype,
      '$beforeValidate'
    )
    const model = createModel(jsonSchema, {
      $beforeValidate: objection.Model.prototype.$beforeValidate
    })
    const ctx = {}
    validator.beforeValidate({ json: {}, model, ctx, options: {} })
    expect(ctx.jsonSchema).toBe(jsonSchema)
    expect($beforeValidate).not.toHaveBeenCalled()
    $beforeValidate.mockRestore()
  })

  it('skips validation without a json schema', () => {
    const json = { title: 1 }
    expect(
      createValidator().validate({
        json,
        model: createModel(null),
        ctx: {},
        options: {}
      })
    ).toBeUndefined()
  })
})

describe('discriminator', () => {
  it('validates only the variant that the discriminator selects', () => {
    const validate = new Validator().compile(
      {
        type: 'object',
        discriminator: { propertyName: 'type' },
        required: ['type'],
        oneOf: [
          {
            properties: { type: { const: 'book' }, pages: { type: 'integer' } }
          },
          { properties: { type: { const: 'film' } } }
        ]
      },
      { throw: false }
    )
    expect(validate({ type: 'book', pages: 'many' })).toBe(false)
    expect(validate.errors.map(({ keyword }) => keyword)).toEqual(['type'])
  })
})
