import { isObject, asArray } from '@ditojs/utils'
import { Controller } from './Controller'
import ControllerAction from './ControllerAction'

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
    this.scope = this.scope || null
    this.collection = this.setupActions('collection')
    this.member = this.isOneToOne ? {} : this.setupActions('member')
    this.findOptions = {
      allowParam: this.allowParam,
      checkRootWhere: false
    }
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
    const { name } = this.modelClass
    // Use a cached dummy instance to validate the format of the passed id.
    const validator = validatorsCache[name] ||
      // eslint-disable-next-line new-cap
      (validatorsCache[name] = new this.modelClass())
    validator.$validate(
      this.modelClass.getIdValues(id),
      { patch: true }
    )
    return id
  }

  setupQuery(query, base = this) {
    const { scope, eagerScope } = base
    const { allowScope, allowFilter } = this

    const asAllowArray = value => value === false ? [] : asArray(value)

    if (allowScope !== undefined && allowScope !== true) {
      query.allowScope(
        ...asAllowArray(allowScope),
        // Also include the scopes defined by scope and eagerScope so these can
        // pass through.
        ...asArray(scope),
        ...asArray(eagerScope)
      )
    }
    if (allowFilter !== undefined && allowFilter !== true) {
      query.allowFilter(...asAllowArray(allowFilter))
    }
    if (scope) {
      query.mergeScope(...asArray(scope))
    }
    if (eagerScope) {
      query.mergeEagerScope(...asArray(eagerScope))
    }
    return query
  }

  async execute(/* transaction, ctx, execute(query, trx) {} */) {
    // Does nothing in base class.
    // Overrides are in ModelController and RelationController.
  }

  async executeAndFetch(action, ctx, modify) {
    const name = `${action}${this.graph ? 'Graph' : ''}AndFetch`
    return this.execute(this.graph, ctx, query =>
      query[name](ctx.request.body)
        .modify(modify)
    )
  }

  async executeAndFetchById(action, ctx, modify) {
    const name = `${action}${this.graph ? 'Graph' : ''}AndFetchById`
    return this.execute(this.graph, ctx, query =>
      query[name](this.getId(ctx), ctx.request.body)
        .throwIfNotFound()
        .modify(modify)
    )
  }

  collection = {
    // Mark action object as $core, so `filterValues()` can correctly filter.
    $core: true,

    async find(ctx, modify) {
      const find = this.isOneToOne ? 'findOne' : 'find'
      const result = await this.execute(false, ctx, query =>
        query[find](ctx.query, this.findOptions).modify(modify)
      )
      // This method doesn't always return an array:
      // For RelationControllers where `isOneToOne` is true, it can return
      // `undefined`. Cast to `null` for such cases:
      return result || null
    },

    async delete(ctx, modify) {
      const count = await this.execute(false, ctx, query => query
        .clearScope()
        .find(ctx.query, this.findOptions)
        .modify(query => this.isOneToOne && query.throwIfNotFound())
        .modify(modify)
        .modify(query => this.unrelate ? query.unrelate() : query.delete())
      )
      return { count }
    },

    async insert(ctx, modify) {
      const result = this.relate
        // Use patchGraphAndFetch() to handle relates for us.
        ? await this.execute(true, ctx, query => query
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
  }

  member = {
    // See collection.$core:
    $core: true,

    async find(ctx, modify) {
      return this.execute(false, ctx, query => query
        .findById(this.getId(ctx), ctx.query, this.findOptions)
        .throwIfNotFound()
        .modify(modify)
      )
    },

    async delete(ctx, modify) {
      const count = await this.execute(false, ctx, query => query
        .clearScope()
        .findById(this.getId(ctx), ctx.query, this.findOptions)
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
  }
}

const actionToVerb = {
  find: 'get',
  delete: 'delete',
  insert: 'post',
  update: 'put',
  patch: 'patch'
}

const validatorsCache = {}
