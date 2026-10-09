import { isObject, isArray, asArray } from '@ditojs/utils'
import { Controller } from './Controller.js'
import { ControllerError, ValidationError } from '../errors/index.js'

// Abstract base class for ModelController and RelationController
export class CollectionController extends Controller {
  graph = false
  scope = null
  relate = false
  unrelate = false
  modelClass = null // To be defined by sub-classes
  isOneToOne = false
  idParam = null
  idValidator = null
  // The handler of `member.get`, resolved by `setup()`, see `getMember()`.
  #memberGetHandler = null

  // @override
  configure() {
    super.configure()
    this.idParam = this.level ? `id${this.level}` : 'id'
  }

  // @override
  setup() {
    // Create a dummy model instance to validate the requested id against.
    // This happens here and not in `configure()`, so that sub-classes can
    // resolve `modelClass` after `super.configure()`, see `ModelController`.
    // eslint-disable-next-line new-cap
    this.idValidator = new this.modelClass()
    // Inherit the member actions here, as `this.member` only holds the routed
    // handlers after `setupActions()`, see `#memberGetHandler` below.
    const memberActions = this.inheritValues('member')
    this.logController()
    this.setProperty('collection', this.setupActions('collection'))
    this.setProperty(
      'member',
      this.isOneToOne ? {} : this.setupActions('member')
    )
    // `getMember()` resolves members through `member.get`, also when `allow`
    // doesn't route it, so set up its handler from the inherited actions then.
    this.#memberGetHandler = Object.hasOwn(this.member, 'get')
      ? this.member.get
      : this.setupActionDefinition(memberActions, 'get').handler
    this.setProperty('assets', this.setupAssets())
  }

  // @override
  setupAssets() {
    const { modelClass } = this
    if (this.assets === true) {
      this.assets = modelClass.definition.assets || null
    } else if (isObject(this.assets)) {
      // Merge in the assets definition from the model into the assets config.
      // That way, we can still use `allow` and `authorize` to control the
      // upload access, while keeping the assets definitions in one central
      // location on the model.
      this.assets = {
        ...modelClass.definition.assets,
        ...this.assets
      }
    } else {
      this.assets = null
    }
    // Now call `super.setupAssets()` which performs the usual inheritance /
    // allow / authorize tricks:
    return super.setupAssets()
  }

  // @override
  getPath(type, path) {
    return type === 'member'
      ? path
        ? `:${this.idParam}/${path}`
        : `:${this.idParam}`
      : path
  }

  getMemberId(ctx) {
    return this.validateId(ctx.params[this.idParam])
  }

  getContextWithMemberId(ctx, memberId = this.getMemberId(ctx)) {
    return ctx.extend({ memberId })
  }

  getModelId(model) {
    const idProperty = this.modelClass.getIdProperty()
    // Handle both composite keys and normal ones.
    return isArray(idProperty)
      ? idProperty.map(property => model[property])
      : model[idProperty]
  }

  getCollectionIds(ctx) {
    return asArray(ctx.request.body).map(
      model => this.validateId(this.getModelId(model))
    )
  }

  getIds(ctx) {
    // Returns the model ids that this request concerns, read from the param
    // for member ids, and from the payload for collection ids:
    const { type } = ctx.action
    return type === 'member'
      ? [this.getMemberId(ctx)]
      : type === 'collection'
        ? this.getCollectionIds(ctx)
        : []
  }

  validateId(id) {
    const reference = this.modelClass.getReference(id)
    // This validates and coerces at the same time, so extract the coerced id
    // from `reference` again afterwards.
    this.idValidator.$validate(reference, {
      coerceTypes: true,
      patch: true
    })
    const values = Object.values(reference)
    return values.length > 1 ? values : values[0]
  }

  async getMember(
    ctx,
    base = this,
    { query = {}, modify = null, forUpdate = false } = {}
  ) {
    // Go through `member.get` so that apps overriding it also control the
    // members that `from: 'member'` parameters and `$owner` checks receive.
    // Pass `query` as `ctx.filteredQuery` and `forUpdate` through `modify`,
    // as overrides pass on `ctx` and `modify` to `super.get()`. Overrides
    // may call `modify` without `trx`, so lock with `ctx.transaction`, the
    // transaction that `execute()` runs the query in.
    return this.#memberGetHandler.call(
      this,
      ctx.extend({ filteredQuery: query }),
      builder => {
        this.setupQuery(builder, base)
        builder.modify(modify)
        if (forUpdate) {
          lockForUpdate(this, builder, ctx.transaction)
        }
      }
    )
  }

  async fetchMember(
    ctx,
    { id, query = {}, modify = null, forUpdate = false }
  ) {
    return this.execute(ctx, (builder, trx) =>
      builder
        .findById(id)
        .find(query, this.allowParam)
        .throwIfNotFound()
        .modify(getModify(modify, trx))
        .modify(builder => forUpdate && lockForUpdate(this, builder, trx))
    )
  }

  query(trx) {
    return this.setupQuery(this.modelClass.query(trx))
  }

  setupQuery(query, base = this) {
    const { scope } = base
    const { allowScope, allowFilter } = this

    const asAllowArray = value => (value === false ? [] : asArray(value))

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
      query.withScope(...asArray(scope))
    }
    return query
  }

  async execute(/* ctx, execute(query, trx) {} */) {
    // Does nothing in base class.
    // Overrides are in ModelController and RelationController.
  }

  async executeAndFetch(action, ctx, modify, body = ctx.request.body) {
    const name = `${action}${this.graph ? 'DitoGraph' : ''}AndFetch`
    return this.execute(ctx, (query, trx) =>
      query[name](body).modify(getModify(modify, trx))
    )
  }

  async executeAndFetchById(action, ctx, modify, body = ctx.request.body) {
    const name = `${action}${this.graph ? 'DitoGraph' : ''}AndFetchById`
    return this.execute(ctx, (query, trx) =>
      query[name](ctx.memberId, body)
        .throwIfNotFound()
        .modify(getModify(modify, trx))
    )
  }

  async relateAndFetch(ctx, modify) {
    // Use patchDitoGraphAndFetch() to insert the model and relate the existing
    // models in its graph. RelationController overrides this to relate models
    // through its relation instead.
    return this.execute(ctx, (query, trx) =>
      query
        .patchDitoGraphAndFetch(ctx.request.body, { relate: true })
        .modify(getModify(modify, trx))
    )
  }

  collection = this.markAsCoreActions({
    async get(ctx, modify) {
      const result = await this.execute(ctx, (query, trx) => {
        query
          .find(ctx.filteredQuery, this.allowParam)
          .modify(getModify(modify, trx))
        return this.isOneToOne ? query.first() : query
      })
      // This method doesn't always return an array:
      // For RelationControllers where `isOneToOne` is true, it can return
      // `undefined`. Cast to `null` for such cases:
      return result || null
    },

    async delete(ctx, modify) {
      const count = await this.execute(ctx, async (query, trx) => {
        query
          // Clear the controller's scopes, but keep the ones requested through
          // the `scope` query parameter, applied directly by `find()`:
          .clearWithScope()
          .find(ctx.filteredQuery, this.allowParam)
          .modify(query => this.isOneToOne && query.throwIfNotFound())
          .modify(getModify(modify, trx))
        if (this.isOneToOne && this.unrelate) {
          // Unrelating `belongsTo` relations patches the owner row, so the
          // count is never 0 and `throwIfNotFound()` can't detect an empty
          // relation. Check that the related row exists first:
          await query.clone().first().throwIfNotFound()
        }
        return this.unrelate ? query.unrelate() : query.delete()
      })
      return { count }
    },

    async post(ctx, modify) {
      const result = this.relate
        ? await this.relateAndFetch(ctx, modify)
        : await this.executeAndFetch('insert', ctx, modify)
      ctx.status = 201 // Created
      if (isObject(result)) {
        // Fill in the route parameters of the controller's url, e.g. the `:id`
        // of the parent model in the url of relation controllers:
        const url = formatRouteUrl(this.url, ctx.params)
        ctx.set('Location', `${url}/${this.getModelId(result)}`)
      }
      return result
    },

    async put(ctx, modify) {
      validateCollectionUpdateBody(ctx.request.body, this.graph)
      return this.executeAndFetch('update', ctx, modify)
    },

    async patch(ctx, modify) {
      validateCollectionUpdateBody(ctx.request.body, this.graph)
      return this.executeAndFetch('patch', ctx, modify)
    }
  })

  member = this.markAsCoreActions({
    async get(ctx, modify) {
      return this.fetchMember(ctx, {
        id: ctx.memberId,
        query: ctx.filteredQuery,
        modify
      })
    },

    async delete(ctx, modify) {
      const count = await this.execute(ctx, (query, trx) =>
        query
          // Clear the controller's scopes, but keep the ones requested through
          // the `scope` query parameter, applied directly by `find()`:
          .clearWithScope()
          .findById(ctx.memberId)
          .find(ctx.filteredQuery, this.allowParam)
          .throwIfNotFound()
          .modify(getModify(modify, trx))
          .modify(query => (this.unrelate ? query.unrelate() : query.delete()))
      )
      return { count }
    },

    async put(ctx, modify) {
      return this.executeAndFetchById('update', ctx, modify)
    },

    async patch(ctx, modify) {
      return this.executeAndFetchById('patch', ctx, modify)
    }
  })
}

function lockForUpdate(controller, builder, trx) {
  if (!trx) {
    throw new ControllerError(
      controller,
      'Using `forUpdate()` without a transaction is invalid'
    )
  }
  builder.forUpdate()
}

function validateCollectionUpdateBody(body, isGraph) {
  // Without graphs, Objection only supports updating collections through
  // arrays, as its `patchAndFetch()` & co. are instance-only for objects.
  if (!isGraph && !isArray(body)) {
    throw new ValidationError({
      type: 'BodyValidation',
      message: 'Updating a collection requires an array of models'
    })
  }
}

function formatRouteUrl(url, params) {
  // Substitute the route parameters (e.g. `:id`) with the request's values.
  return url.replace(/:(\w+)/g, (match, name) =>
    name in params ? encodeURIComponent(params[name]) : match
  )
}

export function getModify(modify, trx) {
  return modify
    ? query => modify(query, trx)
    : null
}
