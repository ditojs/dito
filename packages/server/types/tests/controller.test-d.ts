import { expectTypeOf, assertType, describe, it } from 'vitest'
import type {
  Controller,
  ModelController,
  CollectionController,
  RelationController,
  QueryBuilder,
  Model,
  KoaContext,
  ModelControllerActionHandler,
  ControllerActionHandler
} from '../index.d.ts'
import type { Transaction } from 'objection'

describe('Controller', () => {
  it('getMember accepts ctx and returns Promise<Model | null>', () => {
    const ctrl = {} as Controller
    expectTypeOf(ctrl.getMember({} as KoaContext)).toEqualTypeOf<
      Promise<Model | null>
    >()
  })

  it('setProperty accepts string key and unknown value', () => {
    const ctrl = {} as Controller
    expectTypeOf(ctrl.setProperty).toBeFunction()
    ctrl.setProperty('foo', 42)
    ctrl.setProperty('bar', 'hello')
  })

  it('action handler this is typed to controller', () => {
    type Handler = ControllerActionHandler<Controller>
    const handler: Handler = function (ctx) {
      expectTypeOf(this).not.toBeAny()
      expectTypeOf(this).toEqualTypeOf<Controller>()
      expectTypeOf(ctx).not.toBeAny()
      expectTypeOf(ctx).toMatchTypeOf<KoaContext>()
    }
  })
})

describe('CollectionController', () => {
  it('getMember returns typed model or null', () => {
    const ctrl = {} as CollectionController<Model>
    const result = ctrl.getMember(
      {} as KoaContext,
      undefined,
      { forUpdate: true }
    )
    expectTypeOf(result).toEqualTypeOf<Promise<Model | null>>()
  })

  it('executeAndFetch modify receives query and trx', () => {
    const ctrl = {} as CollectionController<Model>
    ctrl.executeAndFetch(
      'patch',
      {} as KoaContext,
      (query, trx) => {
        expectTypeOf(query).not.toBeAny()
        expectTypeOf(query)
          .toMatchTypeOf<QueryBuilder<Model>>()
        expectTypeOf(trx).not.toBeAny()
        expectTypeOf(trx)
          .toEqualTypeOf<Transaction | undefined>()
      }
    )
  })

  it('executeAndFetchById modify receives query and trx', () => {
    const ctrl = {} as CollectionController<Model>
    ctrl.executeAndFetchById(
      'patch',
      {} as KoaContext,
      (query, trx) => {
        expectTypeOf(query).not.toBeAny()
        expectTypeOf(query)
          .toMatchTypeOf<QueryBuilder<Model>>()
        expectTypeOf(trx).not.toBeAny()
        expectTypeOf(trx)
          .toEqualTypeOf<Transaction | undefined>()
      }
    )
  })
})

describe('ModelController', () => {
  it('action handler this is typed to the controller', () => {
    type Handler = ModelControllerActionHandler<ModelController<Model>>
    const handler: Handler = function (ctx) {
      expectTypeOf(this).not.toBeAny()
      expectTypeOf(this)
        .toEqualTypeOf<ModelController<Model>>()
      expectTypeOf(ctx).not.toBeAny()
      expectTypeOf(ctx).toMatchTypeOf<KoaContext>()
    }
  })
})

describe('RelationController', () => {
  it('parent is CollectionController', () => {
    const ctrl = {} as RelationController<Model>
    expectTypeOf(
      ctrl.parent
    ).toMatchTypeOf<CollectionController>()
  })

  it('has relation-specific properties', () => {
    const ctrl = {} as RelationController<Model>
    expectTypeOf(ctrl.isOneToOne).toBeBoolean()
    expectTypeOf(ctrl.relate).toBeBoolean()
    expectTypeOf(ctrl.unrelate).toBeBoolean()
    expectTypeOf(ctrl.object).toEqualTypeOf<Record<string, unknown>>()
  })
})
