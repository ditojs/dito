import { Application } from '../app/Application.js'
import { Model } from '../models/Model.js'

class Item extends Model {}

describe('QueryBuilder: chainable configuration methods', () => {
  it('returns the query builder from omit()', () => {
    const query = Item.query()
    expect(query.omit('name')).toBe(query)
  })

  it('returns the query builder from allowScope()', () => {
    const query = Item.query()
    expect(query.allowScope('published')).toBe(query)
  })

  it('returns the query builder from clearAllowScope()', () => {
    const query = Item.query()
    expect(query.clearAllowScope()).toBe(query)
  })

  it('returns the query builder from allowFilter()', () => {
    const query = Item.query()
    expect(query.allowFilter('text')).toBe(query)
  })
})

describe('QueryBuilder: child queries', () => {
  class Recipe extends Model {
    static scopes = {
      quick: query => query.where('minutes', '<', 30)
    }
  }

  it('inherits the allowed scopes of a parent of the same model', () => {
    const parent = Recipe.query().allowScope('quick')
    const child = Recipe.query().childQueryOf(parent)
    expect(() => child.withScope('quick')).not.toThrow()
    expect(() => child.withScope('vegan')).toThrow(
      `Query scope 'vegan' is not allowed.`
    )
  })

  it('does not share the allowed scopes with the parent', () => {
    const parent = Recipe.query().allowScope('quick')
    const child = Recipe.query().childQueryOf(parent).allowScope('vegan')
    expect(() => child.withScope('vegan')).not.toThrow()
    expect(() => parent.withScope('vegan')).toThrow(
      `Query scope 'vegan' is not allowed.`
    )
  })

  it('allows all scopes when the parent allows all', () => {
    const parent = Recipe.query()
    const child = Recipe.query().childQueryOf(parent)
    expect(() => child.withScope('vegan')).not.toThrow()
  })
})

describe('QueryBuilder: write queries in other databases', () => {
  class Ingredient extends Model {
    static properties = {
      name: { type: 'string' }
    }
  }

  new Application({
    config: {
      log: { silent: true },
      knex: { client: 'sqlite3', useNullAsDefault: true }
    },
    models: { Ingredient }
  })

  it('truncates without PostgreSQL specific options', () => {
    const query = Ingredient.query().truncate({ restart: true, cascade: true })
    const { sql } = query.toKnexQuery().toSQL()
    expect(sql).toBe('delete from `Ingredient`')
  })

  it('inserts arrays of models with insert() and insertAndFetch()', () => {
    const data = [{ name: 'Flour' }, { name: 'Sugar' }]
    const insert = Ingredient.query().insert(data)
    const insertAndFetch = Ingredient.query().insertAndFetch(data)
    expect(insert.has('insert')).toBe(true)
    expect(insert.has('insertGraph')).toBe(false)
    expect(insertAndFetch.has('insertAndFetch')).toBe(true)
    expect(insertAndFetch.has('insertGraphAndFetch')).toBe(false)
  })
})
