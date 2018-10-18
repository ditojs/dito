import { Controller } from './Controller'
import ControllerAction from './ControllerAction'
import { isObject, asArray } from '@ditojs/utils'

// Abstract base class for ModelController and RelationController
export class CollectionController extends Controller {
  constructor(app, namespace) {
    super(app, namespace)
    this.isOneToOne = false
    this.relate = false
    this.unrelate = false
  }

  setup(isRoot) {
    super.setup(isRoot, false)
    this.idParam = this.level ? `id${this.level}` : 'id'
    this.graph = !!this.graph
    this.transacted = !!this.transacted
    this.scope = this.scope || null
    this.collection = this.setupActions('collection')
    this.member = this.isOneToOne ? {} : this.setupActions('member')
  }

  // @override
  setupAction(type, name, handler, authorize) {
    if (name in actionToVerb) {
      // NOTE: `ControllerAction` is used even for the default member actions,
      // since they don't need to fetch members ahead of their call.
      const verb = actionToVerb[name]
      this.setupActionRoute(
        type,
        new ControllerAction(this, handler, type, name, verb, '', authorize)
      )
    } else {
      return super.setupAction(type, name, handler, authorize)
    }
  }

  // @override
  getPath(type, path) {
    return type === 'member'
      ? path ? `:${this.idParam}/${path}` : `:${this.idParam}`
      : path
  }

  getId(ctx) {
    const id = ctx.params[this.idParam]
    // Create a dummy model instance to validate the requested id against.
    // eslint-disable-next-line new-cap
    const model = new this.modelClass()
    model.$validate(
      this.modelClass.getReference(id),
      { patch: true }
    )
    return id
  }

  setupQuery(query, base = this) {
    const { scope } = base
    const { allowScope, allowFilter } = this

    const asAllowArray = value => value === false ? [] : asArray(value)

    if (allowScope !== undefined && allowScope !== true) {
      query.allowScope(
        ...asAllowArray(allowScope),
        // Also include the scopes defined by scope so these can pass through.
        ...asArray(scope)
      )
    }
    if (allowFilter !== undefined && allowFilter !== true) {
      query.allowFilter(...asAllowArray(allowFilter))
    }
    if (scope) {
      query.mergeScope(...asArray(scope))
    }
    return query
  }

  async execute(/* ctx, execute(query, trx) {} */) {
    // Does nothing in base class.
    // Overrides are in ModelController and RelationController.
  }

  async executeAndFetch(action, ctx, modify) {
    const name = `${action}${this.graph ? 'Graph' : ''}AndFetch`
    return this.execute(ctx, query =>
      query[name](ctx.request.body)
        .modify(modify)
    )
  }

  async executeAndFetchById(action, ctx, modify) {
    const name = `${action}${this.graph ? 'Graph' : ''}AndFetchById`
    return this.execute(ctx, query =>
      query[name](this.getId(ctx), ctx.request.body)
        .throwIfNotFound()
        .modify(modify)
    )
  }

  toCoreActions(actions) {
    // Mark action object and methods as core, so `Controller.processValues()`
    // can filter correctly.
    for (const action of Object.values(actions)) {
      // Mark action functions also, so ControllerAction can use it to determine
      // value for `transacted`.
      action.core = true
    }
    actions.$core = true
    return actions
  }

  collection = this.toCoreActions({
    async find(ctx, modify) {
      const result = await this.execute(ctx, query => {
        query.find(ctx.query, this.allowParam).modify(modify)
        return this.isOneToOne ? query.first() : query
      })
      // This method doesn't always return an array:
      // For RelationControllers where `isOneToOne` is true, it can return
      // `undefined`. Cast to `null` for such cases:
      return result || null
    },

    async delete(ctx, modify) {
      const count = await this.execute(ctx, query => query
        .clearScope()
        .find(ctx.query, this.allowParam)
        .modify(query => this.isOneToOne && query.throwIfNotFound())
        .modify(modify)
        .modify(query => this.unrelate ? query.unrelate() : query.delete())
      )
      return { count }
    },

    async insert(ctx, modify) {
      const result = this.relate
        // Use patchGraphAndFetch() to handle relates for us.
        ? await this.execute(ctx, query => query
          .patchGraphAndFetch(ctx.request.body, { relate: true })
          .modify(modify)
        )
        : await this.executeAndFetch('insert', ctx, modify)
      ctx.status = 201
      if (isObject(result)) {
        ctx.set('Location', this.getUrl('collection', result.id))
      }
      return result
    },

    async update(ctx, modify) {
      return this.executeAndFetch('update', ctx, modify)
    },

    async patch(ctx, modify) {
      return this.executeAndFetch('patch', ctx, modify)
    }
  })

  member = this.toCoreActions({
    async find(ctx, modify) {
      return this.execute(ctx, query => query
        .findById(this.getId(ctx))
        .find(ctx.query, this.allowParam)
        .throwIfNotFound()
        .modify(modify)
      )
    },

    async delete(ctx, modify) {
      const count = await this.execute(ctx, query => query
        .clearScope()
        .findById(this.getId(ctx))
        .find(ctx.query, this.allowParam)
        .throwIfNotFound()
        .modify(modify)
        .modify(query => this.unrelate ? query.unrelate() : query.delete())
      )
      return { count }
    },

    async update(ctx, modify) {
      return this.executeAndFetchById('update', ctx, modify)
    },

    async patch(ctx, modify) {
      return this.executeAndFetchById('patch', ctx, modify)
    }
  })
}

const actionToVerb = {
  find: 'get',
  delete: 'delete',
  insert: 'post',
  update: 'put',
  patch: 'patch'
}
