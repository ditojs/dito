import { expectTypeOf, assertType, describe, it } from 'vitest'
import type {
  Model,
  QueryBuilder,
  ModelScopes,
  ModelFilters,
  ModelHooks,
  ModelFilterFunction,
  ModelProperty
} from '../index.d.ts'
import type { Transaction } from 'objection'
import type { Item } from './fixtures.ts'

describe('Model', () => {
  it('initialize returns void or Promise<void>', () => {
    expectTypeOf<typeof Model.initialize>()
      .returns.toEqualTypeOf<void | Promise<void>>()
  })

  it('getAttributes requires a filter function', () => {
    expectTypeOf<typeof Model.getAttributes>()
      .toBeCallableWith((prop: ModelProperty) => true)
    expectTypeOf<typeof Model.getAttributes>()
      .parameter(0)
      .not.toBeUndefined()
  })

  it('$is accepts Model, null, or undefined', () => {
    const item = {} as Item
    expectTypeOf(item.$is)
      .parameter(0)
      .toEqualTypeOf<Model | null | undefined>()
    assertType<boolean>(item.$is(null))
    assertType<boolean>(item.$is(undefined))
    assertType<boolean>(item.$is({} as Item))
  })

  it('$transaction handler overload', () => {
    const item = {} as Item
    assertType<Promise<any>>(
      item.$transaction(async trx => {
        expectTypeOf(trx).toMatchTypeOf<Transaction>()
      })
    )
  })

  it('$transaction trx + handler overload', () => {
    const item = {} as Item
    assertType<Promise<any>>(
      item.$transaction(
        {} as Transaction,
        async trx => {
          expectTypeOf(trx).toMatchTypeOf<Transaction>()
        }
      )
    )
  })

  it('static transaction overloads exist', () => {
    expectTypeOf<typeof Model.transaction>()
      .toBeCallableWith()
    expectTypeOf<typeof Model.transaction>()
      .toBeCallableWith(async (trx: any) => {})
  })

  it('scopes handler receives query and applyParentScope', () => {
    const scopes: ModelScopes<Model> = {
      active(query, applyParentScope) {
        expectTypeOf(query).toMatchTypeOf<QueryBuilder<Model>>()
        expectTypeOf(applyParentScope).toEqualTypeOf<
          (query: QueryBuilder<Model>) => QueryBuilder<Model>
        >()
        return applyParentScope(query)
      }
    }
    assertType<ModelScopes<Model>>(scopes)
  })

  it('filters handler receives typed query builder', () => {
    const filter: ModelFilterFunction<Model> = (
      query,
      ...args
    ) => {
      expectTypeOf(query).toMatchTypeOf<QueryBuilder<Model>>()
      return query
    }
    assertType<ModelFilterFunction<Model>>(filter)
  })

  it('hooks keys match lifecycle patterns', () => {
    const hooks: ModelHooks<Model> = {
      'before:insert'(args) {},
      'after:find'(args) {},
      'before:update'(args) {},
      'after:delete'(args) {}
    }
    assertType<ModelHooks<Model>>(hooks)
  })

  it('QueryBuilderType uses Dito QueryBuilder', () => {
    const model = {} as Model
    expectTypeOf(model.QueryBuilderType).toEqualTypeOf<
      QueryBuilder<Model, Model[]>
    >()
  })
})
