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
