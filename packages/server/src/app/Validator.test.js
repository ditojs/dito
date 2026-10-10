import { vi } from 'vitest'
import objection from 'objection'
import { Validator } from './Validator.js'

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

  it.each(['#ff8800', 'red', 'rgba(0, 0, 255, 0.5)', 'hsl(30, 100%, 50%)', ''])(
    'accepts any string, as before 3.3.0: %j',
    color => {
      expect(validate({ color })).toBe(true)
    }
  )

  it('rejects values that are not strings', () => {
    expect(validate({ color: { r: 255, g: 136, b: 0 } })).toBe(false)
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

  it('skips disabled keywords, formats and types', () => {
    const validator = new Validator({
      keywords: { range: null },
      formats: { color: null },
      types: { color: null }
    })
    const validate = validator.compile(
      {
        type: 'object',
        properties: {
          pages: { type: 'integer', range: [1, 10] },
          tint: { type: 'string', format: 'color' }
        }
      },
      { throw: false }
    )
    // Ajv runs with `strict: false`, so unknown keywords and formats pass.
    expect(validate({ pages: 100, tint: 'not a color' })).toBe(true)
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

  it('removes the null type errors of nullable `oneOf` schemas', () => {
    expect(
      validator.parseErrors([
        {
          instancePath: '/cover',
          keyword: 'type',
          message: 'must be null',
          params: { type: 'null' }
        },
        {
          instancePath: '/cover',
          keyword: 'oneOf',
          message: 'must match exactly one schema in oneOf',
          params: {}
        }
      ])
    ).toEqual({})
  })

  it('keeps pairs of errors that are not caused by `nullable`', () => {
    const errors = [
      {
        instancePath: '/title',
        keyword: 'type',
        message: 'must be string',
        params: { type: 'string' }
      },
      {
        instancePath: '/title',
        keyword: 'oneOf',
        message: 'must match exactly one schema in oneOf',
        params: {}
      }
    ]
    expect(Object.keys(validator.parseErrors(errors))).toEqual(['title'])
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
