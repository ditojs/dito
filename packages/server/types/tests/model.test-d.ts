import { expectTypeOf, assertType, describe, it } from 'vitest'
import type {
  Model,
  QueryBuilder,
  SerializedModel,
  ModelScopes,
  ModelFilters,
  ModelHooks,
  ModelFilterFunction,
  ModelProperty
} from '../index.d.ts'
import type { View } from '../../../admin/types/index.d.ts'
import type { Transaction } from 'objection'
import type { Item } from './fixtures.ts'

describe('Model', () => {
  it('initialize returns void or Promise<void>', () => {
    expectTypeOf<typeof Model.initialize>()
      .returns.toEqualTypeOf<void | Promise<void>>()
  })

  it('getAttributes requires a filter function', () => {
    expectTypeOf<typeof Model.getAttributes>()
      .toBeCallableWith(
        (prop: ModelProperty) => true
      )
    expectTypeOf<typeof Model.getAttributes>()
      .parameter(0)
      .not.toBeUndefined()
  })

  it('$patch accepts Date for date fields', () => {
    interface TimestampedItem extends Model {
      title: string
      createdAt: Date
    }
    const item = {} as TimestampedItem
    item.$patch({ title: 'test' })
    item.$patch({ createdAt: new Date() })
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
        expectTypeOf(trx).not.toBeAny()
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
          expectTypeOf(trx).not.toBeAny()
          expectTypeOf(trx)
            .toMatchTypeOf<Transaction>()
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
        expectTypeOf(query).not.toBeAny()
        expectTypeOf(query)
          .toMatchTypeOf<QueryBuilder<Model>>()
        expectTypeOf(applyParentScope)
          .not.toBeAny()
        expectTypeOf(applyParentScope).toEqualTypeOf<
          (
            query: QueryBuilder<Model>
          ) => QueryBuilder<Model>
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
      expectTypeOf(query).not.toBeAny()
      expectTypeOf(query)
        .toMatchTypeOf<QueryBuilder<Model>>()
      return query
    }
    assertType<ModelFilterFunction<Model>>(filter)
  })

  it('hooks keys match lifecycle patterns', () => {
    const hooks: ModelHooks<Model> = {
      'before:insert'(args) {
        expectTypeOf(args).not.toBeAny()
      },
      'after:find'(args) {
        expectTypeOf(args).not.toBeAny()
      },
      'before:update'(args) {
        expectTypeOf(args).not.toBeAny()
      },
      'after:delete'(args) {
        expectTypeOf(args).not.toBeAny()
      }
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

describe('SerializedModel', () => {
  it('strips functions, $-prefixed, and internal keys', () => {
    interface TestModel extends Model {
      title: string
      $meta: string
    }
    type Result = SerializedModel<TestModel>
    expectTypeOf<keyof Result>()
      .toEqualTypeOf<'id' | 'title'>()
  })

  it('converts Date properties to string (JSON serialization)', () => {
    interface TimestampedModel extends Model {
      createdAt: Date
      updatedAt?: Date
      timestamps: Date[]
    }
    type Result =
      SerializedModel<TimestampedModel>
    expectTypeOf<Result['createdAt']>()
      .toEqualTypeOf<string>()
    expectTypeOf<Result['updatedAt']>()
      .toEqualTypeOf<string | undefined>()
    expectTypeOf<Result['timestamps']>()
      .toEqualTypeOf<string[]>()
  })

  it('View<SerializedModel<T>> assignable to View<any> through Record', () => {
    interface StreamCheckModel extends Model {
      result: string
      functioning: boolean
      channelId: number
      createdAt: Date
      src: string
      logs?: Record<string, any>[]
    }
    type StreamCheck =
      SerializedModel<StreamCheckModel>
    const view: View<StreamCheck> = {
      type: 'view',
      components: {
        result: { type: 'text' }
      },
      panels: {
        info: {
          type: 'panel',
          components: {
            src: { type: 'text' }
          }
        }
      }
    }
    const views = { streamChecks: view }
    assertType<Record<string, View<any>>>(views)
  })
})
