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
  ControllerAction,
  ControllerActionHandler,
  ControllerActions,
  Page
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

  it('typed action params flow to handler', () => {
    type Params = {
      'get search': { query: string }
      'post create': { name: string; count: number }
    }
    const actions: ControllerActions<Controller, Params> = {
      'get search': {
        handler(ctx, { query }) {
          expectTypeOf(query).not.toBeAny()
          expectTypeOf(query).toBeString()
        }
      },
      'post create': {
        handler(ctx, { name, count }) {
          expectTypeOf(name).not.toBeAny()
          expectTypeOf(name).toBeString()
          expectTypeOf(count).not.toBeAny()
          expectTypeOf(count).toBeNumber()
        }
      }
    }
  })

  it('ControllerAction with typed params', () => {
    const action: ControllerAction<Controller, { query: string }> = {
      parameters: { query: { type: 'string' } },
      handler(ctx, { query }) {
        expectTypeOf(query).not.toBeAny()
        expectTypeOf(query).toBeString()
      }
    }
  })

  it('ControllerAction rejects mismatched parameter schema', () => {
    const action: ControllerAction<Controller, { query: string }> = {
      // @ts-expect-error query should be Schema<string>, not Schema<number>
      parameters: { query: { type: 'number' } },
      handler(ctx, { query }) {}
    }
  })

  it('untyped actions accept params', () => {
    const actions: ControllerActions<Controller> = {
      'get list': {
        handler(ctx, params) {
          expectTypeOf(params).toBeAny()
        }
      }
    }
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

  it('execute infers return type from callback', () => {
    const ctrl = {} as CollectionController<Model>
    const result = ctrl.execute(
      {} as KoaContext,
      (query, trx) => {
        expectTypeOf(query).not.toBeAny()
        expectTypeOf(query).toMatchTypeOf<QueryBuilder<Model>>()
        return query.findById(1)
      }
    )
    expectTypeOf(result).not.toBeAny()
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

  it('hook handler this is typed to the controller', () => {
    const ctrl = {} as ModelController<Model>
    ctrl.hooks = {
      'before:collection:get'(ctx) {
        expectTypeOf(this).not.toBeAny()
        expectTypeOf(this).toEqualTypeOf<ModelController<Model>>()
        expectTypeOf(ctx).not.toBeAny()
        expectTypeOf(ctx).toMatchTypeOf<KoaContext>()
      }
    }
  })

  it('hooks accept valid key patterns', () => {
    const ctrl = {} as ModelController<Model>
    ctrl.hooks = {
      'before:collection:get'() {},
      'after:collection:get session'() {},
      'after:member:patch'() {},
      'before:*:get'() {},
      '*:collection:*'() {},
      '*:*:*'() {}
    }
  })

  it('subclass hook handlers have this typed to the subclass', () => {
    type TaskController = ModelController<Model> & {
      customMethod(): void
    }
    const ctrl = {} as TaskController
    ctrl.hooks = {
      'after:collection:get'(ctx) {
        expectTypeOf(this).not.toBeAny()
        expectTypeOf(this).toEqualTypeOf<TaskController>()
        expectTypeOf(ctx).not.toBeAny()
        expectTypeOf(ctx).toMatchTypeOf<KoaContext>()
      }
    }
  })

  it('before: hooks return void', () => {
    const ctrl = {} as ModelController<Model>
    ctrl.hooks = {
      'before:collection:get'(ctx) {
        expectTypeOf(this.hooks!['before:collection:get']).returns.toBeVoid()
      }
    }
  })

  it('after: hooks can return any', () => {
    const ctrl = {} as ModelController<Model>
    ctrl.hooks = {
      'after:collection:get'(ctx, result) {
        expectTypeOf(this.hooks!['after:collection:get']).returns.toBeAny()
        return { modified: true }
      }
    }
  })

  it('after: collection hooks receive ctx and result only', () => {
    const ctrl = {} as ModelController<Model>
    ctrl.hooks = {
      'after:collection:get'(ctx, result) {
        expectTypeOf(ctx).not.toBeAny()
        expectTypeOf(ctx).toMatchTypeOf<KoaContext>()
        expectTypeOf(result).not.toBeAny()
        expectTypeOf(result).toMatchTypeOf<Model[] | Page<Model>>()
      }
    }
    ctrl.hooks = {
      // @ts-expect-error after: hooks only accept two arguments
      'after:collection:get'(ctx, result, extra) {}
    }
  })

  it('after: CRUD item hooks are typed to the model', () => {
    const ctrl = {} as ModelController<Model>
    ctrl.hooks = {
      'after:member:get'(ctx, item) {
        expectTypeOf(item).not.toBeAny()
        expectTypeOf(item).toMatchTypeOf<Model>()
      },
      'after:member:patch'(ctx, item) {
        expectTypeOf(item).not.toBeAny()
        expectTypeOf(item).toMatchTypeOf<Model>()
      },
      'after:member:put'(ctx, item) {
        expectTypeOf(item).not.toBeAny()
        expectTypeOf(item).toMatchTypeOf<Model>()
      },
      'after:member:post'(ctx, item) {
        expectTypeOf(item).not.toBeAny()
        expectTypeOf(item).toMatchTypeOf<Model>()
      },
      'after:collection:post'(ctx, item) {
        expectTypeOf(item).not.toBeAny()
        expectTypeOf(item).toMatchTypeOf<Model>()
      },
      'after:collection:put'(ctx, item) {
        expectTypeOf(item).not.toBeAny()
        expectTypeOf(item).toMatchTypeOf<Model>()
      },
      'after:collection:patch'(ctx, item) {
        expectTypeOf(item).not.toBeAny()
        expectTypeOf(item).toMatchTypeOf<Model>()
      }
    }
  })

  it('after:*:delete result is { count: number }', () => {
    const ctrl = {} as ModelController<Model>
    ctrl.hooks = {
      'after:member:delete'(ctx, result) {
        expectTypeOf(result).not.toBeAny()
        expectTypeOf(result).toMatchTypeOf<{ count: number }>()
      },
      'after:collection:delete'(ctx, result) {
        expectTypeOf(result).not.toBeAny()
        expectTypeOf(result).toMatchTypeOf<{ count: number }>()
      }
    }
  })

  it('after: wildcard and custom hooks fall back to any', () => {
    const ctrl = {} as ModelController<Model>
    ctrl.hooks = {
      'after:*:get'(ctx, result) {
        expectTypeOf(result).toBeAny()
      },
      'after:collection:get stats'(ctx, result) {
        expectTypeOf(result).toBeAny()
      }
    }
  })

  it('after: hooks reject extra arguments', () => {
    const ctrl = {} as ModelController<Model>
    ctrl.hooks = {
      // @ts-expect-error after: hooks only accept two arguments
      'after:member:get'(ctx, item, extra) {}
    }
    ctrl.hooks = {
      // @ts-expect-error after: hooks only accept two arguments
      'after:member:delete'(ctx, result, extra) {}
    }
    ctrl.hooks = {
      // @ts-expect-error after: hooks only accept two arguments
      'after:collection:delete'(ctx, result, extra) {}
    }
  })

  it('before: hooks receive ctx and optional params', () => {
    const ctrl = {} as ModelController<Model>
    ctrl.hooks = {
      'before:collection:get'(ctx, params) {
        expectTypeOf(ctx).not.toBeAny()
        expectTypeOf(ctx).toMatchTypeOf<KoaContext>()
        expectTypeOf(params).toEqualTypeOf<Record<string, any> | undefined>()
      },
      'before:member:patch'(ctx, params) {
        expectTypeOf(ctx).not.toBeAny()
        expectTypeOf(ctx).toMatchTypeOf<KoaContext>()
      },
      'before:member:delete'(ctx, params) {
        expectTypeOf(ctx).not.toBeAny()
        expectTypeOf(ctx).toMatchTypeOf<KoaContext>()
      },
      'before:collection:delete'(ctx, params) {
        expectTypeOf(ctx).not.toBeAny()
        expectTypeOf(ctx).toMatchTypeOf<KoaContext>()
      }
    }
  })

  it('hooks reject invalid keys', () => {
    const ctrl = {} as ModelController<Model>
    ctrl.hooks = {
      // @ts-expect-error bare action name is not a valid hook key
      get() {}
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
