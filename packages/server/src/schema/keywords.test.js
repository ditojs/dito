import { Application } from '../app/Application.js'
import { Model } from '../models/Model.js'
import { ValidationError } from '../errors/index.js'

function createApp(models) {
  return new Application({
    config: { log: { silent: true } },
    models
  })
}

function getValidationErrors(callback) {
  try {
    callback()
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError)
    return error.data.errors
  }
  throw new Error('Expected a validation error')
}

async function getAsyncValidationErrors(promise) {
  const error = await promise.then(
    () => {
      throw new Error('Expected a validation error')
    },
    error => error
  )
  expect(error).toBeInstanceOf(ValidationError)
  return error.data.errors
}

describe('validate keyword', () => {
  const receivedParams = []

  class Recipe extends Model {
    static properties = {
      title: {
        type: 'string',
        validate({ data }) {
          if (data !== data.trim()) {
            throw new Error('must not have surrounding white-space')
          }
        }
      },
      servings: {
        type: 'integer',
        // Returning `false` without an error fails with the default message.
        validate: ({ data }) => data % 2 === 0
      },
      steps: {
        type: 'array',
        items: {
          type: 'string',
          validate(params) {
            receivedParams.push(params)
            return true
          }
        }
      },
      tags: {
        type: 'object',
        patternProperties: {
          '^[a-z]+$': {
            type: 'string',
            validate(params) {
              receivedParams.push(params)
              return true
            }
          }
        }
      },
      slug: {
        type: 'string',
        validate({ data }) {
          // Throw an error that carries Ajv-style errors itself.
          const error = new Error('invalid slug')
          error.errors = [
            {
              instancePath: '/0',
              keyword: 'pattern',
              message: 'must only contain lowercase characters',
              params: {}
            }
          ]
          if (data !== data.toLowerCase()) throw error
        }
      },
      cuisine: {
        type: 'string',
        validate() {
          // Errors without a message are reported by their string conversion.
          throw Object.assign(new Error(), { toString: () => 'too spicy' })
        }
      },
      code: {
        type: 'string',
        async validate({ data }) {
          await Promise.resolve()
          if (data.length !== 4) {
            throw new Error('must have exactly four characters')
          }
        }
      }
    }

    // Root-level validation, validating properties in context of each other.
    static schema = {
      validate({ data: recipe }) {
        if (recipe.servings > 8 && !recipe.title) {
          throw new Error('large recipes need a title')
        }
        return true
      }
    }
  }

  const app = createApp({ Recipe })

  beforeEach(() => {
    receivedParams.length = 0
  })

  it('passes when all validate functions succeed', () => {
    const recipe = Recipe.fromJson({ title: 'Soup', servings: 4 })
    expect(recipe).toBeInstanceOf(Recipe)
    expect(recipe.title).toBe('Soup')
  })

  it('reports thrown error messages at the property data path', () => {
    const errors = getValidationErrors(() =>
      Recipe.fromJson({ title: ' Soup ' })
    )
    expect(errors).toEqual({
      title: [
        {
          keyword: 'validate',
          message: 'must not have surrounding white-space',
          params: {}
        }
      ]
    })
  })

  it('reports the string conversion of errors without a message', () => {
    const errors = getValidationErrors(() =>
      Recipe.fromJson({ cuisine: 'thai' })
    )
    expect(errors).toEqual({
      cuisine: [{ keyword: 'validate', message: 'too spicy', params: {} }]
    })
  })

  it('reports a default error when a validate function returns false', () => {
    const errors = getValidationErrors(() => Recipe.fromJson({ servings: 3 }))
    expect(Object.keys(errors)).toEqual(['servings'])
    expect(errors.servings[0].keyword).toBe('validate')
  })

  it('prefixes Ajv-style errors thrown by validate functions', () => {
    const errors = getValidationErrors(() => Recipe.fromJson({ slug: 'Pasta' }))
    expect(errors).toEqual({
      'slug/0': [
        {
          keyword: 'pattern',
          message: 'must only contain lowercase characters',
          params: {}
        }
      ]
    })
  })

  it('reports errors of root-level validate functions', () => {
    const errors = getValidationErrors(() => Recipe.fromJson({ servings: 10 }))
    expect(errors).toEqual({
      '': [
        {
          keyword: 'validate',
          message: 'large recipes need a title',
          params: {}
        }
      ]
    })
  })

  it('passes array indices to validate functions as parentIndex', () => {
    const recipe = { steps: ['chop', 'boil'] }
    Recipe.fromJson(recipe)
    expect(receivedParams).toHaveLength(2)
    const [first, second] = receivedParams
    expect(first).toMatchObject({
      data: 'chop',
      parentIndex: 0,
      instancePath: '/steps/0'
    })
    expect(first).not.toHaveProperty('parentKey')
    expect(second).toMatchObject({ data: 'boil', parentIndex: 1 })
    expect(first.parentData).toEqual(['chop', 'boil'])
    expect(first.rootData).toMatchObject(recipe)
  })

  it('passes object keys to validate functions as parentKey', () => {
    Recipe.fromJson({ tags: { cuisine: 'italian' } })
    expect(receivedParams).toHaveLength(1)
    const [params] = receivedParams
    expect(params).toMatchObject({
      data: 'italian',
      parentKey: 'cuisine',
      instancePath: '/tags/cuisine'
    })
    expect(params).not.toHaveProperty('parentIndex')
  })

  it('passes the app, validator and options to validate functions', () => {
    Recipe.fromJson({ steps: ['stir'] })
    const [params] = receivedParams
    expect(params.app).toBe(app)
    expect(params.validator).toBe(app.validator)
    expect(params.ctx.app).toBe(app)
    expect(params.options).toBeInstanceOf(Object)
  })

  it('skips async validate functions in synchronous validation', () => {
    expect(Recipe.fromJson({ code: 'abc' }).code).toBe('abc')
  })

  it('runs async validate functions in asynchronous validation', async () => {
    const recipe = await Recipe.fromJson({ code: 'abcd' }, { async: true })
    expect(recipe).toBeInstanceOf(Recipe)
    expect(recipe.code).toBe('abcd')
  })

  it('reports errors of async validate functions', async () => {
    const errors = await getAsyncValidationErrors(
      Recipe.fromJson({ code: 'abc' }, { async: true })
    )
    expect(errors).toEqual({
      code: [
        {
          keyword: 'validate',
          message: 'must have exactly four characters',
          params: {}
        }
      ]
    })
  })

  it('reports sync and async errors together in async validation', async () => {
    const errors = await getAsyncValidationErrors(
      Recipe.fromJson({ title: ' Soup', code: 'abc' }, { async: true })
    )
    expect(Object.keys(errors).toSorted()).toEqual(['code', 'title'])
  })
})

describe('instanceof keyword', () => {
  class Ingredient extends Model {
    static properties = {
      name: { type: 'string' }
    }
  }

  class Pantry extends Model {
    static properties = {
      label: {
        instanceof: 'Buffer'
      },
      stockedAt: {
        instanceof: ['Date', 'String']
      },
      favorite: {
        instanceof: 'Ingredient'
      },
      unknown: {
        instanceof: ['NotAModelOrConstructor', { name: 'Date' }]
      }
    }
  }

  createApp({ Ingredient, Pantry })

  it('accepts instances of built-in constructors', () => {
    const label = Buffer.from('flour')
    const pantry = Pantry.fromJson({ label, stockedAt: new Date() })
    expect(pantry.label).toBe(label)
  })

  it('accepts instances of any of the listed constructors', () => {
    // Only String objects are instances of `String`, not string primitives.
    expect(() =>
      Pantry.fromJson({ stockedAt: new String('today') })
    ).not.toThrow()
    const errors = getValidationErrors(() =>
      Pantry.fromJson({ stockedAt: 'today' })
    )
    expect(errors.stockedAt[0].keyword).toBe('instanceof')
  })

  it('accepts instances of models registered with the app', () => {
    const favorite = Ingredient.fromJson({ name: 'Salt' })
    expect(Pantry.fromJson({ favorite }).favorite).toBe(favorite)
  })

  it('rejects plain objects in place of model instances', () => {
    const errors = getValidationErrors(() =>
      Pantry.fromJson({ favorite: { name: 'Salt' } })
    )
    expect(errors).toEqual({
      favorite: [
        expect.objectContaining({ keyword: 'instanceof' })
      ]
    })
  })

  it('rejects values for unknown constructor names and objects', () => {
    const errors = getValidationErrors(() =>
      Pantry.fromJson({ unknown: new Date() })
    )
    expect(errors.unknown[0].keyword).toBe('instanceof')
  })

  it('accepts constructor functions as types', () => {
    class Shelf extends Model {
      static properties = {
        restockedAt: {
          instanceof: [Date]
        }
      }
    }
    createApp({ Shelf })
    const restockedAt = new Date()
    expect(Shelf.fromJson({ restockedAt }).restockedAt).toBe(restockedAt)
  })
})

describe('range keyword', () => {
  class Rating extends Model {
    static properties = {
      stars: {
        type: 'integer',
        range: [1, 5]
      },
      percentage: {
        type: 'number',
        range: [0, 100]
      }
    }
  }

  createApp({ Rating })

  it('accepts values on and within the boundaries', () => {
    expect(() => Rating.fromJson({ stars: 1, percentage: 0 })).not.toThrow()
    expect(() => Rating.fromJson({ stars: 5, percentage: 100 })).not.toThrow()
    expect(() => Rating.fromJson({ percentage: 33.3 })).not.toThrow()
  })

  it('reports the expanded minimum and maximum keywords', () => {
    const errors = getValidationErrors(() =>
      Rating.fromJson({ stars: 0, percentage: 100.5 })
    )
    expect(errors).toEqual({
      stars: [
        expect.objectContaining({
          keyword: 'minimum',
          params: { comparison: '>=', limit: 1 }
        })
      ],
      percentage: [
        expect.objectContaining({
          keyword: 'maximum',
          params: { comparison: '<=', limit: 100 }
        })
      ]
    })
  })

  it('rejects range definitions that are not number pairs', () => {
    class Broken extends Model {
      static properties = {
        stars: {
          type: 'integer',
          range: [1]
        }
      }
    }
    createApp({ Broken })
    // Schemas compile lazily, on the first validation.
    expect(() => Broken.fromJson({ stars: 1 })).toThrow(
      /keyword "range" value is invalid/
    )
  })
})

describe('relate keyword', () => {
  class Author extends Model {
    static properties = {
      name: { type: 'string' }
    }
  }

  class Book extends Model {
    static properties = {
      title: { type: 'string' }
    }

    static relations = {
      author: {
        relation: 'belongsTo',
        from: 'Book.authorId',
        to: 'Author.id'
      }
    }
  }

  createApp({ Author, Book })

  it('accepts id references for related models', () => {
    const book = Book.fromJson({ title: 'Dune', author: { id: 1 } })
    expect(book.author).toBeInstanceOf(Author)
    expect(book.author.id).toBe(1)
  })

  it('accepts #ref references for related models', () => {
    const book = Book.fromJson(
      { title: 'Dune', author: { '#ref': 'frank' } },
      { graph: true }
    )
    expect(book.author['#ref']).toBe('frank')
  })

  it('validates related data that is not a reference against the model', () => {
    const errors = getValidationErrors(() =>
      Book.fromJson({ author: { id: 1, name: 3 } }, { graph: true })
    )
    // The silent `relate` keyword itself is never reported.
    expect(errors['author/name']).toEqual([
      expect.objectContaining({ keyword: 'type' })
    ])
    expect(
      Object.values(errors)
        .flat()
        .some(error => error.keyword === 'relate')
    ).toBe(false)
  })
})

describe('required and empty formats', () => {
  class Checklist extends Model {
    static properties = {
      title: {
        type: 'string',
        required: true
      },
      notes: {
        type: 'string',
        format: 'empty'
      }
    }
  }

  createApp({ Checklist })

  it('treats empty strings as missing required values', () => {
    const errors = getValidationErrors(() => Checklist.fromJson({ title: '' }))
    expect(errors).toEqual({
      title: [
        {
          keyword: 'format',
          message: 'is required',
          params: { format: 'required' }
        }
      ]
    })
  })

  it('accepts empty values for the empty format', () => {
    expect(() =>
      Checklist.fromJson({ title: 'Groceries', notes: '' })
    ).not.toThrow()
  })

  it('rejects non-empty values for the empty format', () => {
    const errors = getValidationErrors(() =>
      Checklist.fromJson({ title: 'Groceries', notes: 'milk' })
    )
    expect(errors).toEqual({
      notes: [
        {
          keyword: 'format',
          message: 'needs to be empty',
          params: { format: 'empty' }
        }
      ]
    })
  })

  it('skips required checks in patch validation', () => {
    expect(() => Checklist.fromJson({}, { patch: true })).not.toThrow()
    expect(() =>
      Checklist.fromJson({ title: '' }, { patch: true })
    ).not.toThrow()
  })
})

describe('built-in types', () => {
  class Swatch extends Model {
    static properties = {
      color: {
        type: 'color'
      },
      image: {
        type: 'asset',
        nullable: true
      }
    }
  }

  createApp({ Swatch })

  it('accepts any color string for the color type', () => {
    expect(Swatch.fromJson({ color: '#ff8800' }).color).toBe('#ff8800')
    expect(Swatch.fromJson({ color: 'rgb(255, 136, 0)' }).color).toBe(
      'rgb(255, 136, 0)'
    )
  })

  it('rejects non-string values for the color type', () => {
    const errors = getValidationErrors(() => Swatch.fromJson({ color: 255 }))
    expect(Object.keys(errors)).toEqual(['color'])
  })

  it('accepts complete asset objects and null for nullable assets', () => {
    const image = {
      key: 'a1b2.png',
      name: 'photo.png',
      type: 'image/png',
      size: 1024,
      width: 640,
      height: 480
    }
    expect(Swatch.fromJson({ image }).image).toEqual(image)
    expect(Swatch.fromJson({ image: null }).image).toBe(null)
  })

  it('rejects asset objects with missing or unknown properties', () => {
    const errors = getValidationErrors(() =>
      Swatch.fromJson({
        image: { key: 'a1b2.png', name: 'photo.png', size: 1, extra: true }
      })
    )
    expect(errors.image).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyword: 'required',
          params: { missingProperty: 'type' }
        }),
        expect.objectContaining({
          keyword: 'unevaluatedProperties',
          params: { unevaluatedProperty: 'extra' }
        })
      ])
    )
  })
})
