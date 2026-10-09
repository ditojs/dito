import type { ModelProperties } from '@ditojs/server'
import { Model, QueryBuilder } from '@ditojs/server'
import {
  createTestApp,
  createTestDatabase,
  destroyTestApp
} from './setup.js'

class Cook extends Model {
  declare id: number
  declare name: string
  declare active: boolean
  declare recipes: Recipe[]

  static override properties: ModelProperties = {
    name: { type: 'string', required: true },
    active: { type: 'boolean', default: true }
  }

  static override relations = {
    recipes: {
      relation: 'hasMany',
      from: 'Cook.id',
      to: 'Recipe.cookId'
    }
  } as any

  static override scopes = {
    active: (query: any) => query.where('active', true)
  }
}

class Step extends Model {
  declare id: number
  declare text: string
  declare position: number
  declare draft: boolean
  declare recipeId: number

  static override properties: ModelProperties = {
    text: { type: 'string', required: true },
    position: { type: 'integer' },
    draft: { type: 'boolean', default: false },
    recipeId: { type: 'integer', foreign: true, nullable: true }
  }

  static override scopes = {
    final: (query: any) => query.where('draft', false)
  }
}

class Recipe extends Model {
  declare id: number
  declare name: string
  declare description: string | null
  declare servings: number | null
  declare published: boolean
  declare archived: boolean
  declare createdAt: Date | null
  declare details: object | null
  declare cookId: number | null
  declare cook: Cook | null
  declare steps: Step[]

  static override properties: ModelProperties = {
    name: { type: 'string', required: true },
    description: { type: 'string', nullable: true },
    servings: { type: 'integer', nullable: true },
    published: { type: 'boolean', default: false },
    archived: { type: 'boolean', default: false },
    createdAt: { type: 'datetime', nullable: true },
    details: { type: 'object', nullable: true }
  }

  static override relations = {
    cook: {
      relation: 'belongsTo',
      from: 'Recipe.cookId',
      to: 'Cook.id',
      nullable: true
    },
    steps: {
      relation: 'hasMany',
      from: 'Recipe.id',
      to: 'Step.recipeId',
      owner: true
    }
  } as any

  static override scopes = {
    default: (query: any) => query.where('archived', false),
    final: (query: any) => query.where('published', true),
    hearty: (query: any) => query.where('servings', '>=', 4),
    // A scope that requests further scopes:
    finalHearty: (query: any) => query.withScope('final', 'hearty'),
    withSteps: (query: any) => query.withGraph('steps')
  }

  static override filters = {
    name: { filter: 'text' },
    search: { filter: 'text', properties: ['name', 'description'] },
    created: { filter: 'date-range', properties: ['createdAt'] },
    hearty: (query: any) => query.where('servings', '>=', 4)
  } as any
}

describe('QueryBuilder', () => {
  const app = createTestApp({ models: { Cook, Step, Recipe } })

  beforeAll(async () => {
    await createTestDatabase(app)
    await app.setup()
  })

  afterAll(async () => {
    await destroyTestApp(app)
  })

  afterEach(async () => {
    for (const table of ['Step', 'Recipe', 'Cook']) {
      await app.knex(table).del()
    }
  })

  function getNames(models: { name: string }[]) {
    return models.map(model => model.name).sort()
  }

  async function insertRecipes() {
    return Recipe.query().insert([
      { name: 'Apple pie', servings: 8, published: true },
      { name: 'Banana bread', servings: 2, published: true },
      { name: 'Cherry tart', servings: 6, published: false },
      { name: 'Date loaf', servings: 4, published: true, archived: true }
    ])
  }

  describe('scopes', () => {
    it('applies the default scope to normal find queries', async () => {
      await insertRecipes()
      expect(getNames(await Recipe.query())).toEqual([
        'Apple pie',
        'Banana bread',
        'Cherry tart'
      ])
    })

    it('skips the default scope for special selects', async () => {
      await insertRecipes()
      const { count } = (await Recipe.query()
        .count('* as count')
        .first()) as any
      expect(Number(count)).toBe(4)
    })

    it('ignores single scopes with ignoreScope()', async () => {
      await insertRecipes()
      const recipes = await Recipe.query()
        .withScope('final')
        .ignoreScope('default')
      expect(getNames(recipes)).toEqual([
        'Apple pie',
        'Banana bread',
        'Date loaf'
      ])
    })

    it('ignores all scopes with ignoreScope() without arguments', async () => {
      await insertRecipes()
      const recipes = await Recipe.query()
        .withScope('final')
        .ignoreScope()
        // Further scopes to ignore are irrelevant once all are ignored:
        .ignoreScope('hearty')
      expect(recipes).toHaveLength(4)
    })

    it('combines multiple scopes', async () => {
      await insertRecipes()
      const recipes = await Recipe.query().withScope('final', 'hearty')
      expect(getNames(recipes)).toEqual(['Apple pie'])
    })

    it('applies scopes requested by other scopes', async () => {
      await insertRecipes()
      const recipes = await Recipe.query()
        .allowScope('finalHearty')
        .withScope('finalHearty')
      expect(getNames(recipes)).toEqual(['Apple pie'])
    })

    it('rejects scopes that are not allowed', () => {
      expect(() =>
        Recipe.query().allowScope('final').withScope('hearty')
      ).toThrow(`Query scope 'hearty' is not allowed.`)
    })

    it('always allows the default scope and graph scope variants', () => {
      expect(() =>
        Recipe.query()
          .allowScope('^final', null)
          .withScope('default', '^final', null)
      ).not.toThrow()
    })

    it('skips the allowed scopes check when passing `false`', async () => {
      await insertRecipes()
      const recipes = await Recipe.query()
        .allowScope('final')
        .withScope('hearty', false)
      expect(getNames(recipes)).toEqual(['Apple pie', 'Cherry tart'])
    })

    it('clears the allowed scopes with clearAllowScope()', () => {
      expect(() =>
        Recipe.query().allowScope('final').clearAllowScope().withScope('hearty')
      ).not.toThrow()
    })

    it('checks allowed scopes in applyScope()', () => {
      expect(() =>
        Recipe.query().allowScope('final').applyScope('hearty')
      ).toThrow(`Query scope 'hearty' is not allowed.`)
    })

    it('applies scopes immediately with applyScope()', async () => {
      await insertRecipes()
      const query = Recipe.query().applyScope('hearty', null)
      expect(query.toKnexQuery().toQuery()).toMatch(/"servings" >= 4/)
      expect(getNames(await query)).toEqual(['Apple pie', 'Cherry tart'])
    })

    it('clears scopes from withScope() but keeps the default one', async () => {
      await insertRecipes()
      const recipes = await Recipe.query().withScope('hearty').clearWithScope()
      expect(recipes).toHaveLength(3)
    })

    it('keeps allowed filters and graph scopes when cloning', async () => {
      await insertRecipes()
      const query = Recipe.query().withScope('^final').allowFilter('name')
      const recipes = await query.clone()
      expect(getNames(recipes)).toEqual(['Apple pie', 'Banana bread'])
      expect(() => query.clone().applyFilter('search', 'pie')).toThrow(
        `Query filter 'search' is not allowed.`
      )
    })

    // clone() only copies graph scopes, so non-graph scopes from withScope()
    // get lost in the copy:
    it.fails('keeps non-graph scopes when cloning queries', async () => {
      await insertRecipes()
      const query = Recipe.query().withScope('hearty')
      expect(getNames(await query.clone())).toEqual([
        'Apple pie',
        'Cherry tart'
      ])
    })

    it('counts the total of ranges with non-graph scopes', async () => {
      await insertRecipes()
      const result = (await Recipe.query().find({
        scope: 'hearty',
        range: '0,0'
      })) as any
      expect(result.total).toBe(2)
    })

    it('ignores scopes that the model does not define', async () => {
      await insertRecipes()
      expect(await Recipe.query().withScope('unknown')).toHaveLength(3)
    })

    it('applies scopes that add graph expressions', async () => {
      const recipe = await Recipe.query().insertGraph({
        name: 'Apple pie',
        steps: [{ text: 'Bake' }]
      } as any)
      const result = await Recipe.query()
        .findById(recipe.id)
        .withScope('withSteps')
      expect(result!.steps.map(step => step.text)).toEqual(['Bake'])
    })
  })

  describe('graph scopes', () => {
    async function insertGraph() {
      await Recipe.query().insertGraph([
        {
          name: 'Apple pie',
          published: true,
          steps: [
            { text: 'Peel', position: 1 },
            { text: 'Taste', position: 2, draft: true }
          ]
        },
        {
          name: 'Cherry tart',
          published: false,
          steps: [{ text: 'Pit', position: 1 }]
        }
      ] as any)
    }

    function getSteps(recipes: Recipe[]) {
      return Object.fromEntries(
        recipes.map(recipe => [
          recipe.name,
          recipe.steps.map(step => step.text).sort()
        ])
      )
    }

    it('applies non-graph scopes to the root query only', async () => {
      await insertGraph()
      const recipes = await Recipe.query().withGraph('steps').withScope('final')
      expect(getSteps(recipes)).toEqual({ 'Apple pie': ['Peel', 'Taste'] })
    })

    it('applies graph scopes to all levels that define them', async () => {
      await insertGraph()
      const recipes = await Recipe.query()
        .withScope('^final')
        .withGraph('steps')
      expect(getSteps(recipes)).toEqual({ 'Apple pie': ['Peel'] })
    })

    it('applies graph scopes with the join algorithm', async () => {
      await insertGraph()
      const recipes = await Recipe.query()
        .withGraphJoined('steps')
        .withScope('^final')
      expect(getSteps(recipes)).toEqual({ 'Apple pie': ['Peel'] })
    })

    it('applies graph scopes through relation modifiers', async () => {
      await insertGraph()
      const recipes = await Recipe.query()
        .withGraph('steps(^final)')
        .withScope('final')
      expect(getSteps(recipes)).toEqual({ 'Apple pie': ['Peel'] })
    })

    it('applies scopes but no graphs to write queries', async () => {
      await insertGraph()
      const count = await Recipe.query()
        .withScope('^final')
        .withGraph('steps')
        .patch({ servings: 3 })
      expect(count).toBe(1)
    })

    it('rejects graph expressions with unknown relations', async () => {
      await expect(
        Recipe.query().withGraph('ingredients').withScope('^final')
      ).rejects.toThrow(`Invalid child expression: 'ingredients'`)
    })
  })

  describe('filters', () => {
    beforeEach(async () => {
      await Recipe.query().insert([
        {
          name: 'Apple pie',
          description: 'Sweet',
          servings: 8,
          createdAt: new Date('2026-01-10T00:00:00Z')
        },
        {
          name: 'Pineapple cake',
          description: 'Fruity apple-free cake',
          servings: 2,
          createdAt: new Date('2026-02-10T00:00:00Z')
        },
        {
          name: 'Plum crumble',
          description: null,
          servings: 4,
          createdAt: new Date('2026-03-10T00:00:00Z')
        }
      ])
    })

    it.each([
      [['apple'], ['Apple pie', 'Pineapple cake']],
      [['contains', 'APPLE'], ['Apple pie', 'Pineapple cake']],
      [['starts-with', 'apple'], ['Apple pie']],
      [['ends-with', 'CAKE'], ['Pineapple cake']],
      [['equals', 'plum crumble'], ['Plum crumble']],
      [['unknown', 'apple'], ['Apple pie', 'Pineapple cake', 'Plum crumble']],
      [['contains', ''], ['Apple pie', 'Pineapple cake', 'Plum crumble']]
    ])('applies text filter arguments %j', async (args, expected) => {
      const recipes = await Recipe.query().applyFilter('name', ...args)
      expect(getNames(recipes)).toEqual(expected)
    })

    it('matches any of multiple filter properties', async () => {
      const recipes = await Recipe.query().applyFilter('search', 'fruity')
      expect(getNames(recipes)).toEqual(['Pineapple cake'])
      const sweet = await Recipe.query().applyFilter('search', 'sweet')
      expect(getNames(sweet)).toEqual(['Apple pie'])
    })

    it.each([
      [
        ['2026-02-01T00:00:00Z', '2026-04-01T00:00:00Z'],
        ['Pineapple cake', 'Plum crumble']
      ],
      [['2026-02-01T00:00:00Z', null], ['Pineapple cake', 'Plum crumble']],
      [[null, '2026-02-01T00:00:00Z'], ['Apple pie']],
      [[null, null], ['Apple pie', 'Pineapple cake', 'Plum crumble']]
    ])('applies date-range filter arguments %j', async (args, expected) => {
      const recipes = await Recipe.query().applyFilter('created', ...args)
      expect(getNames(recipes)).toEqual(expected)
    })

    it('applies multiple filters with an object', async () => {
      const recipes = await Recipe.query().applyFilter({
        name: ['apple'],
        hearty: []
      })
      expect(getNames(recipes)).toEqual(['Apple pie'])
    })

    it('combines filters with other conditions using AND', async () => {
      const recipes = await Recipe.query()
        .where('servings', '<', 3)
        .applyFilter('search', 'apple')
      expect(getNames(recipes)).toEqual(['Pineapple cake'])
    })

    it('rejects filters that are not allowed', () => {
      expect(() =>
        Recipe.query().allowFilter('name').applyFilter('hearty')
      ).toThrow(`Query filter 'hearty' is not allowed.`)
    })

    it('rejects filters that are not defined', () => {
      expect(() => Recipe.query().applyFilter('spicy')).toThrow(
        `Query filter 'spicy' is not defined.`
      )
    })
  })

  describe('find()', () => {
    it('returns the query unchanged without parameters', () => {
      const query = Recipe.query()
      expect(query.find(null)).toBe(query)
    })

    it('applies scope parameters', async () => {
      await insertRecipes()
      const recipes = await Recipe.query().find({ scope: ['final', 'hearty'] })
      expect(getNames(recipes)).toEqual(['Apple pie'])
    })

    it('applies filter parameters with JSON arguments', async () => {
      await insertRecipes()
      const recipes = await Recipe.query().find({
        filter: 'name:"starts-with","b"'
      })
      expect(getNames(recipes)).toEqual(['Banana bread'])
    })

    it('applies multiple filter parameters in array notation', async () => {
      await insertRecipes()
      const recipes = await Recipe.query().find({
        'filter[]': ['name:"a"', 'hearty:']
      })
      expect(getNames(recipes)).toEqual(['Apple pie', 'Cherry tart'])
    })

    it('rejects malformed filter parameters', () => {
      expect(() => Recipe.query().find({ filter: 'name:"broken' })).toThrow(
        /^Invalid Query filter parameters: /
      )
    })

    // Invalid dates are coerced to `Invalid Date` objects before validation,
    // which pass the `date-time` format check and fail later in the database
    // query with a 500 error:
    it.fails('rejects invalid date filter arguments as invalid', async () => {
      await expect(
        Recipe.query().find({ filter: 'created:"no date"' })
      ).rejects.toThrow(
        `The provided data for query filter 'created' is not valid`
      )
    })

    it('applies order parameters', async () => {
      await insertRecipes()
      const descending = await Recipe.query().find({ order: 'servings desc' })
      expect(descending.map(recipe => recipe.name)).toEqual([
        'Apple pie',
        'Cherry tart',
        'Banana bread'
      ])
      const ascending = await Recipe.query().find({ order: ['servings'] })
      expect(ascending.map(recipe => recipe.name)).toEqual([
        'Banana bread',
        'Cherry tart',
        'Apple pie'
      ])
    })

    it('orders null values as requested', async () => {
      await Recipe.query().insert([
        { name: 'Unknown', servings: null },
        { name: 'Small', servings: 1 }
      ])
      const first = await Recipe.query().find({
        order: 'servings asc first'
      })
      expect(first.map(recipe => recipe.name)).toEqual(['Unknown', 'Small'])
      const last = await Recipe.query().find({ order: 'servings asc last' })
      expect(last.map(recipe => recipe.name)).toEqual(['Small', 'Unknown'])
    })

    it('rejects invalid order directions', () => {
      expect(() => Recipe.query().find({ order: 'name up' })).toThrow(
        `Invalid order direction: 'up'.`
      )
    })

    it('ignores empty order and range parameters', async () => {
      await insertRecipes()
      expect(await Recipe.query().find({ order: '', range: '' })).toHaveLength(
        3
      )
    })

    it('paginates with range parameters', async () => {
      await insertRecipes()
      const result = (await Recipe.query().find({
        order: 'name',
        range: '1,2'
      })) as any
      expect(result.total).toBe(3)
      expect(result.results.map((recipe: Recipe) => recipe.name)).toEqual([
        'Banana bread',
        'Cherry tart'
      ])
    })

    it('accepts range parameters as arrays', async () => {
      await insertRecipes()
      const result = (await Recipe.query().find({ range: ['0', '0'] })) as any
      expect(result.results).toHaveLength(1)
    })

    it('rejects ranges that end before they start', () => {
      expect(() => Recipe.query().find({ range: '5,2' })).toThrow(
        'Invalid range: [5, 2].'
      )
    })

    it('applies limit and offset parameters', async () => {
      await insertRecipes()
      const recipes = await Recipe.query().find({
        order: 'name',
        limit: 1,
        offset: 1
      })
      expect(recipes.map(recipe => recipe.name)).toEqual(['Banana bread'])
    })

    it('rejects parameters that are not allowed', () => {
      expect(() =>
        Recipe.query().find({ limit: 1, order: 'name' }, ['limit'])
      ).toThrow(`Query parameter 'order' is not allowed.`)
      expect(() =>
        Recipe.query().find({ 'order[]': ['name'] }, { limit: true })
      ).toThrow(`Query parameter 'order[]' is not allowed.`)
    })

    it('rejects allowed parameters without a handler', () => {
      expect(() => Recipe.query().find({ spicy: 'yes' }, ['spicy'])).toThrow(
        `Invalid query parameter 'spicy' in 'spicy=yes'.`
      )
    })
  })

  describe('graph loading', () => {
    it('rejects unsupported graph algorithms', () => {
      expect(() =>
        Recipe.query().withGraph('steps', { algorithm: 'magic' })
      ).toThrow(`Graph algorithm 'magic' is unsupported.`)
    })

    it('keeps the last used algorithm for merged expressions', async () => {
      const recipe = await Recipe.query().insertGraph({
        name: 'Apple pie',
        cook: { name: 'Ada' },
        steps: [{ text: 'Bake' }]
      } as any)
      const createQuery = () =>
        Recipe.query()
          .findById(recipe.id)
          .withGraphJoined('cook')
          .withGraph('steps')
      const result = await createQuery()
      expect(result!.cook!.name).toBe('Ada')
      expect(result!.steps).toHaveLength(1)
      // The table metadata for `toKnexQuery()` is only there after execution:
      expect(createQuery().toKnexQuery().toQuery()).toMatch(
        /left join "Step"/
      )
    })

    it('loads root properties by data path', async () => {
      await insertRecipes()
      const recipes = await Recipe.query().loadDataPath('name').orderBy('name')
      expect(recipes[0].toJSON()).toEqual({ name: 'Apple pie' })
    })

    it('loads relations by data path', async () => {
      await Recipe.query().insertGraph({
        name: 'Apple pie',
        steps: [{ text: 'Bake' }]
      } as any)
      const [recipe] = await Recipe.query().loadDataPath('steps/*/text')
      expect(recipe.steps.map(step => step.text)).toEqual(['Bake'])
    })

    it('loads JSON properties along with nested data paths', async () => {
      await Recipe.query().insert({
        name: 'Apple pie',
        details: { oven: { temperature: 180 } }
      })
      const [recipe] = await Recipe.query().loadDataPath(
        'details/oven/temperature'
      )
      expect(recipe.details).toEqual({ oven: { temperature: 180 } })
    })

    it('rejects data paths that cannot be loaded fully', () => {
      expect(() => Recipe.query().loadDataPath('name/first')).toThrow(
        `Unable to load full data-path 'name/first' (Unmatched: 'first').`
      )
    })
  })

  describe('result handling', () => {
    it('omits properties from the JSON of the results', async () => {
      await insertRecipes()
      const recipe = await Recipe.query()
        .omit('servings', 'published')
        .findOne('name', 'Apple pie')
      expect(recipe!.servings).toBe(8)
      expect(recipe!.toJSON()).not.toHaveProperty('servings')
      expect(recipe!.toJSON()).not.toHaveProperty('published')
      expect(recipe!.toJSON()).toHaveProperty('name')
    })

    it('plucks values from arrays and single results', async () => {
      await insertRecipes()
      const names = await Recipe.query().orderBy('name').pluck('name')
      expect(names).toEqual(['Apple pie', 'Banana bread', 'Cherry tart'])
      const name = await Recipe.query().orderBy('name').first().pluck('name')
      expect(name).toBe('Apple pie')
      const missing = await Recipe.query()
        .findOne('name', 'Nothing')
        .pluck('name')
      expect(missing).toBeUndefined()
    })

    it('expands model properties to unambiguous column references', () => {
      const { sql } = Recipe.query()
        .select('name AS title', 'unknown')
        .where({ servings: 2 })
        .orderBy('name')
        .toSQL()
      expect(sql).toBe(
        'select "Recipe"."name" as "title", "unknown" from "Recipe" ' +
        'where "Recipe"."servings" = ? order by "Recipe"."name" asc'
      )
    })

    it('selects with raw expressions', async () => {
      await insertRecipes()
      const recipe = await Recipe.query()
        .selectRaw('?? * 2 as double', ['servings'])
        .findOne('name', 'Banana bread')
      expect((recipe as any).double).toBe(4)
    })

    it('detects normal and special selects', () => {
      expect(Recipe.query().select('name').hasNormalSelects()).toBe(true)
      expect(Recipe.query().count().hasSpecialSelects()).toBe(true)
      expect(Recipe.query().select('name').hasSpecialSelects()).toBe(false)
    })
  })

  describe('write operations', () => {
    it('restarts identities when truncating', async () => {
      await insertRecipes()
      await Recipe.query().truncate()
      const recipe = await Recipe.query().insert({ name: 'Fresh' })
      expect(recipe.id).toBe(1)
    })

    it('keeps identities when truncating without restart', async () => {
      await Recipe.query().insert({ name: 'Old' })
      await Recipe.query().truncate({ restart: false, cascade: true })
      const recipe = await Recipe.query().insert({ name: 'Fresh' })
      expect(recipe.id).toBeGreaterThan(1)
    })

    it('updates existing rows with upsert()', async () => {
      await insertRecipes()
      const result = await Recipe.query()
        .where('name', 'Apple pie')
        .upsert({ servings: 10 })
      expect(result).toBeInstanceOf(Recipe)
      expect(result.servings).toBe(10)
      const recipe = await Recipe.query().findOne('name', 'Apple pie')
      expect(recipe!.servings).toBe(10)
    })

    it('inserts missing rows with upsert()', async () => {
      const recipe = await Recipe.query()
        .where('name', 'Apple pie')
        .upsert({ name: 'Apple pie', servings: 6 }, { fetch: true })
      expect(recipe).toBeInstanceOf(Recipe)
      expect(await Recipe.query()).toHaveLength(1)
    })

    it('validates full models when upserting with `update`', async () => {
      await insertRecipes()
      await expect(
        Recipe.query()
          .where('name', 'Apple pie')
          .upsert({ servings: 10 }, { update: true })
      ).rejects.toThrow(/not valid/)
    })

    it('patches and updates by id', async () => {
      const recipe = await Recipe.query().insert({ name: 'Apple pie' })
      await Recipe.query().patchById(recipe.id, { servings: 2 })
      expect((await Recipe.query().findById(recipe.id))!.servings).toBe(2)
      await expect(
        Recipe.query().updateById(recipe.id, { servings: 3 })
      ).rejects.toThrow(/not valid/)
      await Recipe.query().updateById(recipe.id, { name: 'Apple tart' })
      const updated = await Recipe.query().findById(recipe.id)
      expect(updated!.name).toBe('Apple tart')
    })

    it('patches and updates by id and fetches the result', async () => {
      const recipe = await Recipe.query().insert({ name: 'Apple pie' })
      const patched = await Recipe.query().patchAndFetchById(recipe.id, {
        servings: 2
      })
      expect(patched.servings).toBe(2)
      const updated = await Recipe.query().updateAndFetchById(recipe.id, {
        name: 'Apple tart'
      })
      expect(updated.name).toBe('Apple tart')
    })

    it('deletes by id', async () => {
      const [apple] = await insertRecipes()
      expect(await Recipe.query().deleteById(apple.id)).toBe(1)
      expect(await Recipe.query().findById(apple.id)).toBeUndefined()
    })

    it('reports models that are not found', async () => {
      await expect(
        Recipe.query().findById(1234).throwIfNotFound()
      ).rejects.toThrow('Not-found error')
    })

    // Objection.js passes `{}` as the error data to `createNotFoundError()`,
    // which takes precedence over the message with the remembered id:
    it.fails('reports the id of models that are not found', async () => {
      await expect(
        Recipe.query().findById(1234).throwIfNotFound()
      ).rejects.toThrow(`'Recipe' model with id 1234 not found`)
      await expect(
        Recipe.query().deleteById(1234).throwIfNotFound()
      ).rejects.toThrow(`'Recipe' model with id 1234 not found`)
    })

    async function insertCooks() {
      return Cook.query().insert([{ name: 'Ada' }, { name: 'Grace' }])
    }

    it('patches and updates arrays of models', async () => {
      const [ada, grace] = await insertCooks()
      const patched = await Cook.query().patchAndFetch([
        { id: ada.id, active: false },
        { id: grace.id, name: 'Grace H.' }
      ])
      expect(patched.map((cook: Cook) => [cook.name, cook.active])).toEqual([
        ['Ada', false],
        ['Grace H.', true]
      ])
      const updated = await Cook.query().updateAndFetch([
        { id: ada.id, name: 'Ada L.' }
      ])
      expect(updated[0].name).toBe('Ada L.')
    })

    it('patches single models with patchAndFetch()', async () => {
      const [apple] = await insertRecipes()
      const patched = await apple.$query().patchAndFetch({ servings: 1 })
      expect(patched.servings).toBe(1)
      const updated = await apple
        .$query()
        .updateAndFetch({ name: 'Apple tart' })
      expect(updated.name).toBe('Apple tart')
    })

    it('inserts roots but no relations in upsertAndFetch()', async () => {
      const [ada] = await insertCooks()
      const result = await Cook.query().upsertAndFetch([
        { id: ada.id, active: false },
        { name: 'Edsger', recipes: [{ name: 'Apple pie' }] }
      ])
      expect(result.map((cook: Cook) => [cook.name, cook.active])).toEqual([
        ['Ada', false],
        ['Edsger', true]
      ])
      expect(await Cook.query()).toHaveLength(3)
      expect(await Recipe.query()).toHaveLength(0)
    })

    // The `default` scope is applied to `upsertGraph()` queries, which
    // Objection.js rejects when the scope adds `where` conditions:
    it.fails('upserts graphs of models with a default scope', async () => {
      const [apple] = await insertRecipes()
      await Recipe.query().patchAndFetch([{ id: apple.id, servings: 1 }])
    })
  })

  describe('mixin()', () => {
    it('exposes query methods on the target', async () => {
      await insertRecipes()
      const recipes = await Recipe.where('servings', '>', 5)
      expect(getNames(recipes)).toEqual(['Apple pie', 'Cherry tart'])
    })

    it('warns about methods that already exist on the target', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const target = { find() {} }
      try {
        QueryBuilder.mixin(target)
        expect(warn).toHaveBeenCalledWith(
          `There is already a property named 'find' on '[object Object]'`
        )
        expect(Object.keys(target)).toEqual(['find'])
      } finally {
        warn.mockRestore()
      }
    })
  })
})
