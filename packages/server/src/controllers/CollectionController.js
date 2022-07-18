import { isObject, isArray, asArray } from '@ditojs/utils'
import { Controller } from './Controller.js'
import { ControllerError } from '../errors/index.js'

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

  extendContext(ctx, object) {
    // Create a copy of `ctx` that inherits from the real one, but overrides
    // some properties with the ones from the passed `object`.
    return Object.setPrototypeOf(object, ctx)
  }

  getMemberId(ctx) {
    return this.validateId(ctx.params[this.idParam])
  }

  getContextWithMemberId(ctx, memberId = this.getMemberId(ctx)) {
    return this.extendContext(ctx, { memberId })
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

  async getMember(
    ctx,
    base = this,
    { query = {}, modify = null, forUpdate = false } = {}
  ) {
    return this.member.get.call(
      this,
      // Extend `ctx` with a new `query` object, while inheriting the route
      // params in `ctx.params`, so fining the member by id still works.
      this.extendContext(ctx, { query }),
      (query, trx) => {
        this.setupQuery(query, base)
        query.modify(modify)
        if (forUpdate) {
          if (!trx) {
            throw new ControllerError(
              this,
              'Using `forUpdate()` without a transaction is invalid'
            )
          }
          query.forUpdate()
        }
      }
    )
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

  convertToCoreActions(actions) {
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

  collection = this.convertToCoreActions({
    async get(ctx, modify) {
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

    async post(ctx, modify) {
      const result = this.relate
        // Use patchDitoGraphAndFetch() to handle relates for us.
        ? await this.execute(ctx, (query, trx) => query
          .patchDitoGraphAndFetch(ctx.request.body, { relate: true })
          .modify(getModify(modify, trx))
        )
        : await this.executeAndFetch('insert', ctx, modify)
      ctx.status = 201 // Created
      if (isObject(result)) {
        ctx.set('Location', this.getUrl('collection', this.getModelId(result)))
      }
      return result
    },

    async put(ctx, modify) {
      return this.executeAndFetch('update', ctx, modify)
    },

    async patch(ctx, modify) {
      return this.executeAndFetch('patch', ctx, modify)
    }
  })

  member = this.convertToCoreActions({
    async get(ctx, modify) {
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

    async put(ctx, modify) {
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
