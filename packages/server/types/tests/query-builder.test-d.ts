import { expectTypeOf, assertType, describe, it } from 'vitest'
import type { QueryBuilder, Model } from '../index.d.ts'

describe('QueryBuilder', () => {
  type QB = QueryBuilder<Model, Model[]>

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
    assertType<QB>(query.upsert({} as any, { update: true }))
    assertType<QB>(query.upsert({} as any, { fetch: true }))
    assertType<QB>(query.upsert({} as any, {}))
    assertType<QB>(query.upsert({} as any))
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

  it('DitoGraph methods return this for chaining', () => {
    const query = {} as QB
    assertType<QB>(query.insertDitoGraph({} as any))
    assertType<QB>(query.insertDitoGraphAndFetch({} as any))
    assertType<QB>(query.upsertDitoGraph({} as any))
    assertType<QB>(query.upsertDitoGraphAndFetch({} as any))
    assertType<QB>(query.patchDitoGraph({} as any))
    assertType<QB>(query.patchDitoGraphAndFetch({} as any))
    assertType<QB>(
      query.upsertDitoGraphAndFetchById(1, {} as any)
    )
    assertType<QB>(
      query.updateDitoGraphAndFetchById(1, {} as any)
    )
    assertType<QB>(
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

  it('omit returns void (not chainable)', () => {
    const query = {} as QB
    expectTypeOf(query.omit('id')).toBeVoid()
  })
})
