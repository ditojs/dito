import objection from 'objection'
import { asArguments } from '@/utils'
import { Controller } from './Controller'

export class CollectionController extends Controller {
  constructor(app, namespace) {
    super(app, namespace)
    this.isOneToOne = false
  }

  initialize(isRoot) {
    super.initialize(isRoot)
    this.idParam = this.level ? `id${this.level}` : 'id'
    this.graph = !!this.graph
    this.scope = this.scope || null
    this.applyScope = this.scope || this.eagerScope
      ? query => query
        .applyScope(...asArguments(this.scope))
        .eagerScope(...asArguments(this.eagerScope))
      : null
    this.collection = this.setupActions('collection')
    this.member = this.isOneToOne ? {} : this.setupActions('member')
  }

  // @override
  setupAction(action, name, type) {
    let verb = actionToVerb[name]
    let path = ''
    let handler = action
    if (!verb) {
      // A custom action:
      verb = action.verb || 'get'
      path = action.path || this.app.normalizePath(name)
      const getFirstArgument = type === 'member'
        ? ctx => this.member.find.call(this, ctx)
        : null
      handler = ctx => this.callAction(action, ctx, getFirstArgument)
    }
    this.setupRoute(verb, this.getPath(type, path), handler)
  }

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
      this.modelClass.getIdProperties(id),
      { patch: true }
    )
    return id
  }

  execute(transaction, ctx, modify) {
    // NOTE: ctx is required by RelationController which overrides execute().
    const call = modelClass => modify(
      modelClass.query().modify(this.applyScope)
    )
    return transaction
      ? objection.transaction(this.modelClass, call)
      : call(this.modelClass)
  }

  executeAndFetch(action, ctx, modify) {
    const name = `${action}${this.graph ? 'Graph' : ''}AndFetch`
    return this.execute(this.graph, ctx, query =>
      query[name](ctx.request.body)
        .modify(modify)
    )
  }

  executeAndFetchById(action, ctx, modify) {
    const id = this.getId(ctx)
    const name = `${action}${this.graph ? 'Graph' : ''}AndFetchById`
    return this.execute(this.graph, ctx, query =>
      query[name](id, ctx.request.body)
        .modify(modify)
        .throwIfNotFound()
    )
  }

  collection = {
    find(ctx, modify) {
      const find = this.isOneToOne ? 'findOne' : 'find'
      return this.execute(false, ctx, query =>
        query[find](ctx.query)
          .modify(modify)
      )
    },

    delete(ctx, modify) {
      // TODO: Decide if we should set status? status = 204
      return this.execute(false, ctx, query => query
        // TODO: Test if filter works for delete
        .find(ctx.query)
        .modify(modify)
        .clearEager()
        .delete()
        .then(count => ({ count }))
      )
    },

    insert(ctx, modify) {
      return this.executeAndFetch('insert', ctx, modify).then(() => {
        ctx.status = 201
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
      const id = this.getId(ctx)
      return this.execute(false, ctx, query => query
        .findById(id, ctx.query)
        .throwIfNotFound()
        .modify(modify)
      )
    },

    delete(ctx, modify) {
      const id = this.getId(ctx)
      return this.execute(false, ctx, query => query
        .deleteById(id)
        .throwIfNotFound()
        .modify(modify)
        .clearEager()
        // Consider status 204 and no result
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
