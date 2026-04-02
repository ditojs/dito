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
  ModelControllerActions,
  ModelControllerMemberActions,
  ControllerActionHandler
} from '@ditojs/server'
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

  it('inline collection action handlers have typed ctx', () => {
    type MC = ModelController<Model>
    const collection: ModelControllerActions<MC> = {
      get(ctx) {
        expectTypeOf(this).not.toBeAny()
        expectTypeOf(this).toEqualTypeOf<MC>()
        expectTypeOf(ctx).not.toBeAny()
        expectTypeOf(ctx).toMatchTypeOf<KoaContext>()
      }
    }
  })

  it('inline member action handlers have typed ctx', () => {
    type MC = ModelController<Model>
    const member: ModelControllerMemberActions<MC> = {
      async patch(ctx, modify) {
        expectTypeOf(this).not.toBeAny()
        expectTypeOf(this).toEqualTypeOf<MC>()
        expectTypeOf(ctx).not.toBeAny()
        expectTypeOf(ctx).toMatchTypeOf<KoaContext>()
      }
    }
  })

  it('collection authorize accepts partial per-method record', () => {
    type MC = ModelController<Model>
    const collection: ModelControllerActions<MC> = {
      authorize: { get: 'superuser', post: 'admin' }
    }
  })

  it('subclass collection actions have this typed to the subclass', () => {
    type TaskController = ModelController<Model> & {
      customMethod(): void
    }

    const collection: ModelControllerActions<TaskController> = {
      'get stats'(ctx) {
        expectTypeOf(this).not.toBeAny()
        expectTypeOf(this).toEqualTypeOf<TaskController>()
        expectTypeOf(ctx).not.toBeAny()
        expectTypeOf(ctx).toMatchTypeOf<KoaContext>()
      }
    }
  })

it('rejects bare action names', () => {
    type MC = ModelController<Model>
    const collection: ModelControllerActions<MC> = {
      // @ts-expect-error bare action name is not valid
      login(ctx) { return { ok: true } }
    }
  })
})

describe('KoaContext', () => {
  it('ctx.state.user has UserModel properties', () => {
    const ctx = {} as KoaContext
    expectTypeOf(ctx.state.user).not.toBeAny()
    expectTypeOf(ctx.state.user.username).toBeString()
    expectTypeOf(ctx.state.user.$hasRole('admin')).toBeBoolean()
    expectTypeOf(ctx.state.user.$verifyPassword('pw')).toEqualTypeOf<Promise<boolean>>()
    expectTypeOf(ctx.state.user.$isLoggedIn({} as KoaContext)).toBeBoolean()
  })

  it('ctx.state allows unknown keys without augmentation', () => {
    const ctx = {} as KoaContext
    expectTypeOf(ctx.state.anything).toBeUnknown()
  })

  it('ctx.state.user is typed in action handlers', () => {
    type MC = ModelController<Model>
    const collection: ModelControllerActions<MC> = {
      get(ctx) {
        expectTypeOf(ctx.state.user).not.toBeAny()
        expectTypeOf(ctx.state.user.username).toBeString()
        expectTypeOf(ctx.state.user.$hasRole('admin')).toBeBoolean()
      }
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
