import { expectTypeOf, assertType, describe, it } from 'vitest'
import type { QueryBuilder, Model } from '@ditojs/server'

describe('QueryBuilder', () => {
  type QB = QueryBuilder<Model, Model[]>
  type SingleQB = QueryBuilder<Model, Model>

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

  it('upsert options are individually optional', () => {
    const query = {} as QB
    assertType<SingleQB>(query.upsert({} as any, { update: true }))
    assertType<SingleQB>(query.upsert({} as any, { fetch: true }))
    assertType<SingleQB>(query.upsert({} as any, {}))
    assertType<SingleQB>(query.upsert({} as any))
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

  it('find returns this for chaining', () => {
    const query = {} as QB
    assertType<QB>(query.find({}))
    assertType<QB>(
      query.find({}, { scope: true, filter: false })
    )
  })

  it('DitoGraph methods return query builders for their data', () => {
    const query = {} as QB
    assertType<QB>(query.insertDitoGraph([{}]))
    assertType<SingleQB>(query.insertDitoGraph({}))
    assertType<QB>(query.insertDitoGraphAndFetch([{}]))
    assertType<SingleQB>(query.insertDitoGraphAndFetch({}))
    assertType<QB>(query.upsertDitoGraph([{}]))
    assertType<SingleQB>(query.upsertDitoGraph({}))
    assertType<QB>(query.upsertDitoGraphAndFetch([{}]))
    assertType<SingleQB>(query.upsertDitoGraphAndFetch({}))
    assertType<QB>(query.updateDitoGraph([{}]))
    assertType<SingleQB>(query.updateDitoGraph({}))
    assertType<QB>(query.updateDitoGraphAndFetch([{}]))
    assertType<SingleQB>(query.updateDitoGraphAndFetch({}))
    assertType<QB>(query.patchDitoGraph([{}]))
    assertType<SingleQB>(query.patchDitoGraph({}))
    assertType<QB>(query.patchDitoGraphAndFetch([{}]))
    assertType<SingleQB>(query.patchDitoGraphAndFetch({}))
    assertType<SingleQB>(
      query.upsertDitoGraphAndFetchById(1, {} as any)
    )
    assertType<SingleQB>(
      query.updateDitoGraphAndFetchById(1, {} as any)
    )
    assertType<SingleQB>(
      query.patchDitoGraphAndFetchById(1, {} as any)
    )
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
