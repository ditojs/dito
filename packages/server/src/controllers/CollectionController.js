import { Controller } from './Controller'
import { isObject, isArray, asArray } from '@ditojs/utils'

// Abstract base class for ModelController and RelationController
export class CollectionController extends Controller {
  constructor(app, namespace) {
    super(app, namespace)
    this.modelClass = null // To be defined by sub-classes
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
    // Create a dummy model instance to validate the requested id against.
    // eslint-disable-next-line new-cap
    this.idValidator = new this.modelClass()
  }

  // @override
  setupAction(type, name, handler, authorize, verb, path) {
    // These default actions happen directly on the collection / member route
    // and are distinguished by their verbs, not by nested paths.
    if (name in actionToVerb) {
      verb = actionToVerb[name]
      path = ''
    }
    return super.setupAction(type, name, handler, authorize, verb, path)
  }

  // @override
  setupAssets() {
    const { modelClass } = this
    if (this.assets === true) {
      this.assets = modelClass.definition.assets || null
    } else if (isObject(this.assets)) {
      // Merge in the assets definition from the model into the assets config.
      // That way, we can still use `allow` and `authorize` to controll the
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
      ? path ? `:${this.idParam}/${path}` : `:${this.idParam}`
      : path
  }

  getMemberId(ctx) {
    return this.validateId(ctx.params[this.idParam])
  }

  getCollectionIds(ctx) {
    const idProperty = this.modelClass.getIdProperty()
    // Handle both composite keys and normal ones.
    const getId = isArray(idProperty)
      ? model => idProperty.reduce(
        (id, key) => {
          id.push(model[key])
          return id
        }, [])
      : model => model[idProperty]
    return asArray(ctx.request.body).map(model => this.validateId(getId(model)))
  }

  getIds(ctx) {
    // Returns the model ids that this request concerns, read from the param
    // for member ids, and from the payload for collection ids:
    const { type } = ctx.action
    return type === 'member' ? [this.getMemberId(ctx)]
      : type === 'collection' ? this.getCollectionIds(ctx)
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

  query(trx) {
    return this.setupQuery(this.modelClass.query(trx))
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
      query[name](body)
        .modify(getModify(modify, trx))
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
      const result = await this.execute(ctx, (query, trx) => {
        query.find(ctx.query, this.allowParam).modify(getModify(modify, trx))
        return this.isOneToOne ? query.first() : query
      })
      // This method doesn't always return an array:
      // For RelationControllers where `isOneToOne` is true, it can return
      // `undefined`. Cast to `null` for such cases:
      return result || null
    },

    async delete(ctx, modify) {
      const count = await this.execute(ctx, (query, trx) => query
        .ignoreScope()
        .find(ctx.query, this.allowParam)
        .modify(query => this.isOneToOne && query.throwIfNotFound())
        .modify(getModify(modify, trx))
        .modify(query => this.unrelate ? query.unrelate() : query.delete())
      )
      return { count }
    },

    async insert(ctx, modify) {
      const result = this.relate
        // Use patchDitoGraphAndFetch() to handle relates for us.
        ? await this.execute(ctx, (query, trx) => query
          .patchDitoGraphAndFetch(ctx.request.body, { relate: true })
          .modify(getModify(modify, trx))
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
      return this.execute(ctx, (query, trx) => query
        .findById(ctx.memberId)
        .find(ctx.query, this.allowParam)
        .throwIfNotFound()
        .modify(getModify(modify, trx))
      )
    },

    async delete(ctx, modify) {
      const count = await this.execute(ctx, (query, trx) => query
        .ignoreScope()
        .findById(ctx.memberId)
        .find(ctx.query, this.allowParam)
        .throwIfNotFound()
        .modify(getModify(modify, trx))
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

function getModify(modify, trx) {
  return modify
    ? query => modify(query, trx)
    : null
}

const actionToVerb = {
  find: 'get',
  delete: 'delete',
  insert: 'post',
  update: 'put',
  patch: 'patch'
}
