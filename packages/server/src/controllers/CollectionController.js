import { isObject } from '@ditojs/utils'
import { asArguments } from '@/utils'
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
    super.initialize(isRoot)
    this.idParam = this.level ? `id${this.level}` : 'id'
    this.graph = !!this.graph
    this.scope = this.scope || null
    this.applyScope = this.scope || this.eagerScope
      ? query => query
        .scope(...asArguments(this.scope))
        .eagerScope(...asArguments(this.eagerScope))
      : null
    this.collection = this.setupActions('collection')
    this.member = this.isOneToOne ? {} : this.setupActions('member')
  }

  // @override
  setupAction(type, action, name) {
    let verb = actionToVerb[name]
    let path = ''
    let actionClass = ControllerAction
    if (!verb) {
      // A custom action, where member actions need to fetch their member
      // argument through the MemberAction class:
      verb = action.verb || 'get'
      path = action.path || this.app.normalizePath(name)
      actionClass = type === 'member' ? MemberAction : ControllerAction
    }
    this.setupRoute(
      type,
      verb,
      path,
      // eslint-disable-next-line new-cap
      new actionClass(this, action)
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

  execute(/* transaction, ctx, modify */) {
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
    find(ctx, modify) {
      const find = this.isOneToOne ? 'findOne' : 'find'
      return this.execute(false, ctx, query =>
        query[find](ctx.query)
          .modify(modify)
          .then(result => result || null)
      )
    },

    delete(ctx, modify) {
      return this.execute(false, ctx, query => query
        .clearScope()
        .find(ctx.query)
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
    find(ctx, modify) {
      return this.execute(false, ctx, query => query
        .findById(this.getId(ctx), ctx.query)
        .throwIfNotFound()
        .modify(modify)
      )
    },

    delete(ctx, modify) {
      return this.execute(false, ctx, query => query
        .clearScope()
        .findById(this.getId(ctx), ctx.query)
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
