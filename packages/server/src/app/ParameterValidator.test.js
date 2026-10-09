import { Application } from './Application.js'
import { ParameterValidator } from './ParameterValidator.js'
import { Model } from '../models/index.js'

class Recipe extends Model {
  static properties = {
    title: {
      type: 'string'
    },
    servings: {
      type: 'integer'
    }
  }
}

class Menu extends Model {
  static properties = {
    name: {
      type: 'string'
    }
  }

  static fromJson() {
    // Some code throws plain values instead of errors.
    // eslint-disable-next-line no-throw-literal
    throw 'Menus are fixed'
  }
}

function createApp(options) {
  return new Application({
    config: {
      log: { silent: true },
      logger: { prettyPrint: false, level: 'silent' }
    },
    models: { Recipe, Menu },
    ...options
  })
}

function createValidator(parameters, options) {
  return new ParameterValidator(createApp(), parameters, options)
}

describe('ParameterValidator', () => {
  describe('getParameterKey()', () => {
    it('falls back to the data name for unnamed parameters', () => {
      const validator = createValidator([{ type: 'object' }], {
        dataName: 'body'
      })
      expect(validator.getParameterKey({ name: 'title' })).toBe('title')
      expect(validator.getParameterKey({})).toBe('body')
    })
  })

  describe('validateParameters()', () => {
    it('coerces and validates parameters', () => {
      const validator = createValidator({
        servings: { type: 'integer' },
        published: { type: 'date' }
      })
      const params = { servings: '4', published: '2026-01-02' }
      expect(validator.validateParameters(params)).toEqual([])
      expect(params).toEqual({
        servings: 4,
        published: new Date('2026-01-02')
      })
    })

    it('leaves invalid dates for the validation to reject', () => {
      const validator = createValidator({
        published: { type: 'date', format: 'date-time' }
      })
      const params = { published: 'someday' }
      expect(validator.validateParameters(params)).toContainEqual(
        expect.objectContaining({
          instancePath: '/published',
          keyword: 'format'
        })
      )
      expect(params.published).toBe('someday')
    })

    it('skips the coercion of member parameters', () => {
      const validator = createValidator([
        { name: 'recipe', from: 'member', type: 'Recipe' }
      ])
      const recipe = { title: 'Soup' }
      const params = { recipe }
      expect(validator.validateParameters(params)).toEqual([])
      expect(params.recipe).toBe(recipe)
    })

    it('returns errors of async validators as a promise', async () => {
      const validator = createValidator(
        { servings: { type: 'integer' } },
        { async: true }
      )
      const result = validator.validateParameters({ servings: 'many' })
      expect(result).toBeInstanceOf(Promise)
      expect(await result).toMatchObject([
        { instancePath: '/servings', keyword: 'type' }
      ])
      expect(await validator.validateParameters({ servings: '2' })).toEqual([])
    })

    it('rethrows errors that are not validation errors', () => {
      const app = createApp()
      app.validator.keywords.cooked = {
        validate() {
          throw new Error('Kitchen is closed')
        }
      }
      const syncValidator = new ParameterValidator(app, {
        dish: { type: 'string', cooked: true }
      })
      expect(() => syncValidator.validateParameters({ dish: 'soup' })).toThrow(
        'Kitchen is closed'
      )
    })

    it('rejects errors of async validators that are not validation errors', async () => {
      const app = createApp()
      app.validator.keywords.cooked = {
        async: true,
        async validate() {
          throw new Error('Kitchen is closed')
        }
      }
      const asyncValidator = new ParameterValidator(
        app,
        { dish: { type: 'string', cooked: true } },
        { async: true }
      )
      await expect(
        asyncValidator.validateParameters({ dish: 'soup' })
      ).rejects.toThrow('Kitchen is closed')
    })

    it('converts coercion errors to validation errors', () => {
      const validator = createValidator({
        recipe: { type: 'object' },
        menu: { type: 'Menu' }
      })
      const params = { recipe: '{"title":', menu: { name: 'Lunch' } }
      const errors = validator.validateParameters(params)
      expect(errors.slice(0, 2)).toEqual([
        {
          instancePath: '/recipe',
          keyword: 'type',
          message: expect.stringContaining('JSON'),
          params: { type: 'object' }
        },
        {
          instancePath: '/menu',
          keyword: 'type',
          message: 'Menus are fixed',
          params: { type: 'Menu' }
        }
      ])
    })
  })

  describe('coerceValue()', () => {
    const validator = createValidator(null)

    it('parses objects in JSON notation', () => {
      expect(validator.coerceValue('object', '{"title":"Soup"}')).toEqual({
        title: 'Soup'
      })
    })

    it('parses objects in JSON notation without braces', () => {
      expect(validator.coerceValue('object', '"title":"Soup","servings":2'))
        .toEqual({ title: 'Soup', servings: 2 })
    })

    it('parses objects in simplified notation', () => {
      expect(
        validator.coerceValue('object', 'title: Soup, servings: 2, hot:true')
      ).toEqual({ title: 'Soup', servings: 2, hot: true })
    })

    it('coerces objects to model instances', () => {
      const recipe = validator.coerceValue('Recipe', 'title:Soup,servings:2')
      expect(recipe).toBeInstanceOf(Recipe)
      expect(recipe).toMatchObject({ title: 'Soup', servings: 2 })
    })

    it('keeps existing model instances', () => {
      const recipe = Recipe.fromJson({ title: 'Stew' })
      expect(validator.coerceValue(['Recipe', 'null'], recipe)).toBe(recipe)
    })

    it('keeps values that are not objects', () => {
      expect(validator.coerceValue('Recipe', null)).toBe(null)
      expect(validator.coerceValue('string', 'title:Soup')).toBe('title:Soup')
      expect(validator.coerceValue('date', '')).toBe('')
    })
  })
})
