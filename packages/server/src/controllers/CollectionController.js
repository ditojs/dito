import { isObject, asArray } from '@ditojs/utils'
import { Controller } from './Controller'
import ControllerAction from './ControllerAction'
import MemberAction from './MemberAction'

// Abstract base class for ModelController and RelationController
export class CollectionController extends Controller {
  constructor(app, namespace) {
    super(app, namespace)
    this.isOneToOne = false
    this.relate = false
    this.unrelate = false
  }

  initialize(isRoot) {
    super.initialize(isRoot, false)
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
  setupAction(type, name, action, authorize) {
    // NOTE: `ControllerAction` is used for the default member actions, since
    // they don't need to fetch members ahead of their call.
    // Only custom member actions use `MemberAction`.
    let verb, path, actionClass
    if (name in actionToVerb) {
      // A default collection or member action, see `actionToVerb`:
      verb = actionToVerb[name]
      path = ''
      actionClass = ControllerAction
    } else {
      // A custom action, where member actions need to fetch their member
      // argument through the MemberAction class:
      verb = action.verb || 'get'
      path = action.path || this.app.normalizePath(name)
      authorize = action.authorize || authorize
      actionClass = type === 'member' ? MemberAction : ControllerAction
    }
    this.setupActionRoute(
      type,
      verb,
      path,
      authorize,
      // eslint-disable-next-line new-cap
      new actionClass(this, action, authorize)
    )
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

  handleScopes(query) {
    if (this.allowScope) {
      query.allowScope(
        ...this.allowScope,
        // Also include the scopes defined by scope and eagerScope so these can
        // pass through.
        ...asArray(this.scope),
        ...asArray(this.eagerScope)
      )
    }
    if (this.scope) {
      query.mergeScope(...asArray(this.scope))
    }
    if (this.eagerScope) {
      query.mergeEagerScope(...asArray(this.eagerScope))
    }
  }

  execute(/* transaction, ctx, execute(query, trx) {} */) {
    // Does nothing in base class.
  }

  executeAndFetch(action, ctx, modify) {
    const name = `${action}${this.graph ? 'Graph' : ''}AndFetch`
    return this.execute(this.graph, ctx, query =>
      query[name](ctx.request.body)
        .modify(modify)
    )
  }

  executeAndFetchById(action, ctx, modify) {
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

    find(ctx, modify) {
      const find = this.isOneToOne ? 'findOne' : 'find'
      return this.execute(false, ctx, query =>
        query[find](ctx.query, this.findOptions)
          .modify(modify)
          .then(result => result || null)
      )
    },

    delete(ctx, modify) {
      return this.execute(false, ctx, query => query
        .clearScope()
        .find(ctx.query, this.findOptions)
        .modify(query => this.isOneToOne && query.throwIfNotFound())
        .modify(modify)
        .modify(query => this.unrelate ? query.unrelate() : query.delete())
        .then(count => ({ count }))
      )
    },

    insert(ctx, modify) {
      const query = this.relate
        // Use patchGraphAndFetch() to handle relates for us.
        ? this.execute(true, ctx, query => query
          .patchGraphAndFetch(ctx.request.body, { relate: true })
          .modify(modify)
        )
        : this.executeAndFetch('insert', ctx, modify)
      return query.then(result => {
        ctx.status = 201
        if (isObject(result)) {
          ctx.set('Location', this.getUrl('collection', result.id))
        }
      })
    },

    update(ctx, modify) {
      return this.executeAndFetch('update', ctx, modify)
    },

    patch(ctx, modify) {
      return this.executeAndFetch('patch', ctx, modify)
    }
  }

  member = {
    // See collection.$core:
    $core: true,

    find(ctx, modify) {
      return this.execute(false, ctx, query => query
        .findById(this.getId(ctx), ctx.query, this.findOptions)
        .throwIfNotFound()
        .modify(modify)
      )
    },

    delete(ctx, modify) {
      return this.execute(false, ctx, query => query
        .clearScope()
        .findById(this.getId(ctx), ctx.query, this.findOptions)
        .throwIfNotFound()
        .modify(modify)
        .modify(query => this.unrelate ? query.unrelate() : query.delete())
        .then(count => ({ count }))
      )
    },

    update(ctx, modify) {
      return this.executeAndFetchById('update', ctx, modify)
    },

    patch(ctx, modify) {
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
