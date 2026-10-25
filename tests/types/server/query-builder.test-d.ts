import { expectTypeOf, assertType, describe, it } from 'vitest'
import type { QueryBuilder, Model } from '@ditojs/server'

interface Pet extends Model {
  name: string
  owner?: Person
}

interface Person extends Model {
  name: string
  meta?: { color?: string }
  pets?: Pet[]
  parent?: Person | null
}

describe('QueryBuilder', () => {
  type QB = QueryBuilder<Model, Model[]>
  type SingleQB = QueryBuilder<Model, Model>
  type PersonQB = QueryBuilder<Person, Person[]>

  it('applyFilter supports string name with args', () => {
    const query = {} as QB
    assertType<QB>(query.applyFilter('active'))
    assertType<QB>(query.applyFilter('recent', 30))
  })

  it('applyFilter supports object notation', () => {
    const query = {} as QB
    assertType<QB>(
      query.applyFilter({ active: [], recent: [30] })
    )
  })

  it('applyFilter rejects wrong argument types', () => {
    const query = {} as QB
    // @ts-expect-error - first arg must be string or object
    query.applyFilter(123)
  })

  it('upserts single models and arrays', () => {
    const query = {} as QB
    assertType<SingleQB>(query.upsert({}))
    assertType<QB>(query.upsert([{}]))
    // @ts-expect-error - upsert() takes no options
    query.upsert({}, { fetch: true })
    assertType<SingleQB>(query.upsertAndFetch({}))
    assertType<QB>(query.upsertAndFetch([{}]))
  })

  it('scope methods return this for chaining', () => {
    const query = {} as QB
    assertType<QB>(query.withScope('active'))
    assertType<QB>(query.clearWithScope())
    assertType<QB>(query.ignoreScope('default'))
    assertType<QB>(query.applyScope('active'))
  })

  it('withGraph returns this for chaining', () => {
    const query = {} as QB
    assertType<QB>(query.withGraph('[items]'))
    assertType<QB>(
      query.withGraph('[items]', { algorithm: 'fetch' })
    )
  })

  it('withGraph with an algorithm narrows the fetched relations', () => {
    const query = {} as PersonQB
    for (const algorithm of ['fetch', 'join'] as const) {
      const result = query.withGraph('pets.owner', { algorithm })
      expectTypeOf(result).toExtend<QueryBuilder<Person, Person[]>>()
      type Result = Awaited<typeof result>[number]
      expectTypeOf<Result['pets']>().toExtend<Pet[]>()
      expectTypeOf<Result['pets'][number]['owner']>().toExtend<Person>()
      expectTypeOf<Result['parent']>().toEqualTypeOf<
        Person | null | undefined
      >()
    }
    // @ts-expect-error - unsupported algorithm
    query.withGraph('pets', { algorithm: 'naive' })
  })

  it('withGraph narrowing mixes with the other graph methods', () => {
    const query = {} as PersonQB
    const result = query
      .withGraphFetched('pets')
      .withGraph('parent', { algorithm: 'join' })
      .findById(1)
    type Result = NonNullable<Awaited<typeof result>>
    expectTypeOf<Result['pets']>().toExtend<Pet[]>()
    expectTypeOf<Result['parent']>().toEqualTypeOf<Person | null>()
    expectTypeOf(result.withScope('active')).toEqualTypeOf(result)
  })

  it('withGraph does not narrow non-literal expressions', () => {
    const query = {} as PersonQB
    const expression = 'pets' as string
    assertType<PersonQB>(query.withGraph(expression))
  })

  it('patchById and updateById return the number of rows', () => {
    const query = {} as QB
    expectTypeOf(
      query.patchById(1, {})
    ).resolves.toEqualTypeOf<number>()
    expectTypeOf(
      query.updateById(1, {})
    ).resolves.toEqualTypeOf<number>()
  })

  it('toFindQuery returns a find query of the model', () => {
    const query = {} as QueryBuilder<Person, number>
    expectTypeOf(query.toFindQuery()).toEqualTypeOf<
      QueryBuilder<Person, Person[]>
    >()
  })

  it('writes and fetches rows without relation data', () => {
    const query = {} as PersonQB
    expectTypeOf(
      query.patchAndFetch({ name: 'Ada' })
    ).resolves.toEqualTypeOf<Person>()
    expectTypeOf(
      query.updateAndFetch([{ name: 'Ada' }])
    ).resolves.toEqualTypeOf<Person[]>()
    // Only patches write parts of json columns:
    query.patchAndFetch({ 'meta:color': 'red' })
    // @ts-expect-error - updates write whole values
    query.updateAndFetch({ 'meta:color': 'red' })
    // @ts-expect-error - relation data needs the graph methods
    query.upsert({ name: 'Ada', pets: [] })
  })

  it('find returns this for chaining', () => {
    const query = {} as QB
    assertType<QB>(query.find({}))
    assertType<QB>(
      query.find({}, { scope: true, filter: false })
    )
  })

  it('graph methods return query builders for their data', () => {
    const query = {} as QB
    assertType<QB>(query.insertGraph([{}]))
    assertType<SingleQB>(query.insertGraph({}))
    assertType<QB>(query.insertGraphAndFetch([{}]))
    assertType<SingleQB>(query.insertGraphAndFetch({}))
    assertType<QB>(query.upsertGraph([{}]))
    assertType<SingleQB>(query.upsertGraph({}))
    assertType<QB>(query.upsertGraphAndFetch([{}]))
    assertType<SingleQB>(query.upsertGraphAndFetch({}))
    assertType<QB>(query.updateGraph([{}]))
    assertType<SingleQB>(query.updateGraph({}))
    assertType<QB>(query.updateGraphAndFetch([{}]))
    assertType<SingleQB>(query.updateGraphAndFetch({}))
    assertType<QB>(query.patchGraph([{}]))
    assertType<SingleQB>(query.patchGraph({}))
    assertType<QB>(query.patchGraphAndFetch([{}]))
    assertType<SingleQB>(query.patchGraphAndFetch({}))
    assertType<SingleQB>(
      query.upsertGraphAndFetchById(1, {} as any)
    )
    assertType<SingleQB>(
      query.updateGraphAndFetchById(1, {} as any)
    )
    assertType<SingleQB>(
      query.patchGraphAndFetchById(1, {} as any)
    )
  })

  it('graph methods take the settings of strict graphs', () => {
    const query = {} as QB
    query.upsertGraph({}, { relations: { '*': { removed: 'preserve' } } })
    query.patchGraph({}, { root: { kept: 'preserve' } })
    query.insertGraph({}, { relations: { genres: { added: 'insert' } } })
    // @ts-expect-error - strict graphs don't take the old options
    query.patchGraph({}, { noDelete: true })
    // @ts-expect-error - inserts don't remove rows
    query.insertGraph({}, { relations: { genres: { removed: 'delete' } } })
  })

  it('truncate accepts optional restart and cascade', () => {
    const query = {} as QB
    assertType<QB>(query.truncate())
    assertType<QB>(
      query.truncate({ restart: true, cascade: true })
    )
  })

  it('pluck returns this for chaining', () => {
    const query = {} as QB
    assertType<QB>(query.pluck('title'))
  })

  it('toSQL returns sql and bindings', () => {
    const query = {} as QB
    const result = query.toSQL()
    expectTypeOf(result).not.toBeAny()
    expectTypeOf(result.sql).not.toBeAny()
    expectTypeOf(result.sql).toBeString()
    expectTypeOf(result.bindings)
      .not.toBeAny()
    expectTypeOf(result.bindings)
      .toEqualTypeOf<unknown[]>()
  })

  it('omit returns this for chaining', () => {
    const query = {} as QB
    assertType<QB>(query.omit('id'))
  })
})
