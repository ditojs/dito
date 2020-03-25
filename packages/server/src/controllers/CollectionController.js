import { Controller } from './Controller'
import ControllerAction from './ControllerAction'
import { isObject, isArray, asArray, flatten, getDataPath } from '@ditojs/utils'

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
  setupAssets() {
    const { modelClass } = this
    // Merge in the assets definition from the model into the assets config.
    // That way, we can still use `allow` and `authorize` to controll the upload
    // access, while keeping the assets definitions in one central location on
    // the model.
    if (this.assets === true || isObject(this.assets)) {
      this.assets = {
        ...modelClass.definition.assets,
        ...this.assets
      }
    } else {
      this.assets = null
    }
    // Now call `super.setupAssets()` which performs the usual inheritance /
    // allow / authorize tricks:
    const assets = super.setupAssets()
    if (assets) {
      const dataPaths = Object.keys(assets)

      const loadDataPaths = query => dataPaths.reduce(
        (query, dataPath) => query.loadDataPath(dataPath),
        query
      )

      const getFiles = models => dataPaths.reduce(
        (allFiles, dataPath) => {
          allFiles[dataPath] = asArray(models).reduce(
            (files, model) => {
              const data = asArray(getDataPath(model, dataPath, () => null))
              // Use flatten() as dataPath may contain wildcards, resulting in
              // nested files arrays.
              files.push(...flatten(data).filter(file => !!file))
              return files
            },
            []
          )
          return allFiles
        },
        {}
      )

      this.on([
        'before:*:update',
        'before:*:patch',
        'before:*:delete'
      ], async ctx => {
        ctx.assets = {
          before: getFiles(
            await loadDataPaths(
              modelClass.query(ctx.transaction).findByIds(this.getIds(ctx))
            )
          )
        }
      })

      this.on([
        'after:*:insert',
        'after:*:update',
        'after:*:patch',
        'after:*:delete'
      ], async (ctx, result) => {
        const { action } = ctx
        const isDelete = action.name === 'delete'
        const before = ctx.assets?.before || {}
        const after = isDelete ? {} : getFiles(result)
        for (const dataPath of dataPaths) {
          const { storage } = assets[dataPath]
          const _before = before[dataPath] || []
          const _after = after[dataPath] || []
          const added = _after.filter(
            file => !_before.find(it => it.name === file.name)
          )
          const removed = _before.filter(
            file => !_after.find(it => it.name === file.name)
          )
          const foreignAssetsAdded = await this.app.changeAssets(
            storage, added, removed, ctx.transaction
          )
          if (foreignAssetsAdded && !isDelete) {
            // Since the actual foreign file objects were already modified by
            // `changeAssets()`, all that's remaining to do is to call the
            // associated patch action, with the changed data:
            const execute = action.type === 'member'
              ? 'executeAndFetchById'
              : 'executeAndFetch'
            return this[execute]('patch', ctx, null, result)
          }
        }
      })
    }
    return assets
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
    this.idValidator.$validate(
      this.modelClass.getReference(id),
      { patch: true }
    )
    return id
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
    const name = `${action}${this.graph ? 'Graph' : ''}AndFetch`
    return this.execute(ctx, (query, trx) =>
      query[name](body)
        .modify(getModify(modify, trx))
    )
  }

  async executeAndFetchById(action, ctx, modify, body = ctx.request.body) {
    const name = `${action}${this.graph ? 'Graph' : ''}AndFetchById`
    return this.execute(ctx, (query, trx) =>
      query[name](this.getMemberId(ctx), body)
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
        // Use patchGraphAndFetch() to handle relates for us.
        ? await this.execute(ctx, (query, trx) => query
          .patchGraphAndFetch(ctx.request.body, { relate: true })
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
        .findById(this.getMemberId(ctx))
        .find(ctx.query, this.allowParam)
        .throwIfNotFound()
        .modify(getModify(modify, trx))
      )
    },

    async delete(ctx, modify) {
      const count = await this.execute(ctx, (query, trx) => query
        .ignoreScope()
        .findById(this.getMemberId(ctx))
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
