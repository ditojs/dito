import chalk from 'chalk'
import { getOwnProperty, getAllKeys, describeFunction } from '@/utils'
import { EventEmitter } from '@/lib'
import ControllerAction from './ControllerAction'
import MemberAction from './MemberAction'
import {
  ResponseError, WrappedError, ControllerError, AuthorizationError
} from '@/errors'
import {
  isObject, isString, isArray, isBoolean, isFunction, asArray,
  parseDataPath, normalizeDataPath
} from '@ditojs/utils'

export class Controller {
  constructor(app, namespace) {
    this.app = app
    this.namespace = this.namespace || namespace
    this.logging = this.app.config.log.routes
    this.level = 0
  }

  // @overridable
  initialize() {
  }

  setup(isRoot = true, setupActionsObject = true) {
    this._setupEmitter(this.hooks, {
      // Support wildcard hooks only on controllers:
      wildcard: true
    })
    // If the class name ends in 'Controller', remove it from controller name.
    this.name = this.name ||
      this.constructor.name.match(/^(.*?)(?:Controller|)$/)[1]
    if (this.path === undefined) {
      this.path = this.app.normalizePath(this.name)
    }
    this.transacted = !!this.transacted
    if (isRoot) {
      const { path, namespace } = this
      // TODO: The distinction between  `url` and `path` is a bit tricky, since
      // what we call `url` here is called `path` in Router, and may contain
      // mapped parameters or wildcards. Consider `path` / `route` instead?
      const url = path ? `/${path}` : ''
      this.url = namespace ? `/${namespace}${url}` : url
      this.log(
        `${
          namespace ? chalk.green(`/${namespace}/`) : ''
        }${
          chalk.cyan(path)
        }${
          chalk.white(':')
        }`,
        this.level
      )
      if (setupActionsObject) {
        this.actions = this.actions || this.reflectActionsObject()
        // Now that the instance fields are reflected in the `controller` object
        // we can use the normal inheritance mechanism through `setupActions()`:
        this.actions = this.setupActions('actions')
      }
      this.assets = this.setupAssets()
    }
  }

  reflectActionsObject() {
    // On base controllers, the actions can be defined directly in the class
    // instead of inside an actions object, as is done with model and relation
    // controllers. But in order to use the same structure for inheritance as
    // these other controllers, we reflect these instance fields in a separate
    // `actions` object.
    const { allow } = this
    const controller = allow ? { allow } : {}

    const addAction = key => {
      const value = this[key]
      // NOTE: Only add instance methods that have a @action() decorator,
      // which in turn sets the `verb` property on the method, or action objects
      // which have the `verb` property:
      if (value?.verb) {
        controller[key] = value
      }
    }
    // Use `Object.getOwnPropertyNames()` to get the fields, in order to
    // not also receive values from parents (those are fetched later in
    // `inheritValues()`, see `getParentValues()`).
    const proto = Object.getPrototypeOf(this)
    Object.getOwnPropertyNames(proto).forEach(addAction)
    Object.getOwnPropertyNames(this).forEach(addAction)
    return controller
  }

  setupRoute(verb, url, transacted, authorize, action, handlers) {
    this.log(
      `${
        chalk.magenta(verb.toUpperCase())
      } ${
        chalk.green(this.url)
      }${
        chalk.cyan(url.slice(this.url.length))
      } ${
        chalk.white(this.describeAuthorize(authorize))
      }`,
      this.level + 1
    )
    this.app.addRoute(verb, url, transacted, handlers, this, action)
  }

  setupActions(type) {
    const {
      values: actions,
      authorize
    } = this.processValues(this.inheritValues(type))
    for (const [name, handler] of Object.entries(actions)) {
      this.setupAction(type, actions, name, handler, authorize[name])
    }
    return actions
  }

  setupAction(
    type,
    actions,
    name,
    handler,
    authorize,
    // These values are only changed when called from
    // `CollectionController.setupAction()`:
    verb = 'get',
    // The default path for actions is the normalized name.
    path = this.app.normalizePath(name)
  ) {
    if (!isFunction(handler)) {
      handler = setupHandlerFromObject(handler, actions)
    }
    // Custom member actions have their own class so they can fetch the members
    // ahead of their call.
    const actionClass = type === 'member' ? MemberAction : ControllerAction
    this.setupActionRoute(
      type,
      // eslint-disable-next-line new-cap
      new actionClass(this, handler, type, name, verb, path, authorize)
    )
  }

  setupActionRoute(type, action) {
    const url = this.getUrl(type, action.path)
    const { verb, transacted, authorize } = action
    this.setupRoute(verb, url, transacted, authorize, action, [
      async ctx => {
        try {
          const res = await action.callAction(ctx)
          if (res !== undefined) {
            ctx.body = res
          }
        } catch (err) {
          throw err instanceof ResponseError ? err : new WrappedError(err)
        }
      }
    ])
  }

  setupAssets() {
    const {
      values: assets,
      authorize
    } = this.processValues(this.inheritValues('assets'))
    for (const [dataPath, config] of Object.entries(assets || {})) {
      this.setupAssetRoute(dataPath, config, authorize[dataPath])
    }
    return assets
  }

  setupAssetRoute(dataPath, config, authorize) {
    const {
      storage: storageName,
      // TODO: What exactly should control the use of `transacted`?
      transacted,
      ...settings
    } = config
    const storage = this.app.getStorage(storageName)
    if (!storage) {
      throw new ControllerError(this,
        `Unknown storage configuration: '${storageName}'`
      )
    }
    const tokens = parseDataPath(dataPath)
    const getDataPath = callback => normalizeDataPath(tokens.map(callback))

    // Replace wildcards with numbered indices and convert to '/'-notation:
    let index = 0
    const multipleWildcards = tokens.filter(token => token === '*').length > 1
    const normalizedPath = getDataPath(
      token => token === '*'
        ? multipleWildcards
          ? `:index${++index}`
          : ':index'
        : this.app.normalizePath(token)
    )

    // Convert `dataPath` to a regular expression to match field names
    // against, but convert wildcards (*) to match both numeric ids and words,
    // e.g. 'create':
    const matchDataPath = new RegExp(
      `^${getDataPath(token => token === '*' ? '\\w+' : token)}$`
    )

    const url = this.getUrl('controller', `upload/${normalizedPath}`)
    const upload = storage.getUploadHandler({
      ...settings,
      // Only let uploads pass that match the normalizePath + wildcards:
      fileFilter: (req, file, cb) => {
        cb(null, matchDataPath.test(file.fieldname))
      }
    })

    const authorization = this.processAuthorize(authorize)
    this.setupRoute('post', url, transacted, authorize, null, [
      async (ctx, next) => {
        await this.handleAuthorization(authorization, ctx)
        return next()
      },

      upload,

      async (ctx, next) => {
        const files = storage.convertStorageFiles(ctx.request.files)
        await this.app.createAssets(storage, files, 0, ctx.transaction)
        // Send the file objects back for the upload component to store in the
        // data.
        ctx.body = files
        return next()
      }
    ])
  }

  compose() {
    // To be overridden in sub-classes, if the controller needs to install
    // middleware. For normal routes, use `this.app.addRoute()` instead.
  }

  getPath(type, path) {
    // To be overridden by sub-classes.
    return path
  }

  getUrl(type, path) {
    path = this.getPath(type, path)
    // Use '.' as the path for the controller's "index" action.
    return path && path !== '.' ? `${this.url}/${path}` : this.url
  }

  inheritValues(type) {
    // Gets the controller class's instance field for a given action type, e.g.
    // `controller` (Controller), `collection`, `member` (ModelController,
    // RelationController), `relation` (RelationController), and sets up an
    // inheritance chain for it that goes all the way up to it base class (e.g.
    // CollectionController), so that the default definitions for all http verbs
    // can be correctly inherited and overridden while using `super.<action>()`.
    const parentClass = Object.getPrototypeOf(this.constructor)
    // Create one instance of each controller class up the chain in order to
    // get to their definitions of the inheritable values. Cache both instance
    // and resolved values per parentClass in an inheritanceMap.
    if (!inheritanceMap.has(parentClass)) {
      inheritanceMap.set(parentClass, {
        // eslint-disable-next-line new-cap
        instance: new parentClass(this.app, this.namespace)
      })
    }
    const entry = inheritanceMap.get(parentClass)
    if (!entry[type]) {
      const parent = entry.instance
      let values = parent[type]
      if (parentClass !== Controller) {
        // Recursively set up inheritance chains.
        values = parent.inheritValues(type)
      }
      entry[type] = values
    }
    // If there are no values defined on `this` that differ from the parent,
    // set to an empty object so inheritance can be set up and `processValues()`
    // can still be called.
    // NOTE: We can't check with `this.hasOwnProperty(type)` because the
    // field can be on the class prototype as well, in case of accessors.
    const parentValues = entry[type]
    let currentValues = this[type]
    if (currentValues && currentValues === parentValues) {
      currentValues = this[type] = {}
    }
    // Combine parentValues and currentValues with correct inheritance.
    return isObject(parentValues) && isObject(currentValues)
      ? Object.setPrototypeOf(currentValues, parentValues)
      : currentValues
  }

  processValues(values) {
    if (!values) return {}
    // Respect `allow` settings and clear entries that aren't allowed.
    // Also collect and expand `authorize` settings so that in the end, an
    // `authorize` object can be returned with valid settings for all values.
    //
    // Rules:
    // - Own values on objects that don't define an `allow` array are
    //   automatically allowed. If an `allow` array is defined as well, then
    //   these own values need to be explicitly listed.
    // - If no `allow` arrays are defined in the prototypal hierarchy, each
    //   level allows its own values, and these are merged, except for those
    //   marked as `$core`, which need to be explicitly listed in `allow`.

    // NOTE: `handleAllow()` and `handleAuthorize()` are applied in sequence of
    // the `values` inheritance, from sub-class to base-class.

    const mergedAllow = {}
    const mergedAuthorize = {}
    let hasOwnAllow = false

    const excludeKey = key => ['allow', 'authorize'].includes(key)

    const handleAllow = (allow, current) => {
      if (allow) {
        allow = asArray(allow)
        hasOwnAllow = true
      } else if (!hasOwnAllow) {
        // Only keep adding to the merged `allow` if we didn't already encounter
        // an own `allow` object further up the chain.
        allow = Object.keys(current)
      }
      if (allow) {
        if (allow.includes('*')) {
          allow = getAllKeys(current)
        }
        for (const key of allow) {
          if (!excludeKey(key)) {
            mergedAllow[key] = true
          }
        }
      }
    }

    const handleAuthorize = authorize => {
      const add = (key, value) => {
        // Since we're walking up in the inheritance chain, only take on an
        // authorize setting for a given key if it wasn't already defined before
        if (
          key in values &&
          !(key in mergedAuthorize) &&
          !excludeKey(key)
        ) {
          mergedAuthorize[key] = value
        }
      }

      if (isObject(authorize)) {
        for (const key in authorize) {
          add(key, authorize[key])
        }
      } else if (authorize != null) {
        // This is a values-wide setting. Loop through all values, not just
        // current ones, and apply to any action that doesn't already have one:
        for (const key in values) {
          add(key, authorize)
        }
      }
    }

    // Process the `allow` and `authorize` settings in sequence of the `values`
    // inheritance, from sub-class to base-class.
    let current = values
    while (current !== Object.prototype && !current.hasOwnProperty('$core')) {
      handleAllow(getOwnProperty(current, 'allow'), current)
      handleAuthorize(getOwnProperty(current, 'authorize'))
      current = Object.getPrototypeOf(current)
    }

    // At the end of the chain, also support both settings on the controller-
    // level, and thus applied to all action objects in the controller.
    if (this.allow) {
      handleAllow(this.allow, values)
    }
    if (this.authorize) {
      handleAuthorize(this.authorize)
    }

    return {
      // Create a filtered `values` object that only contains the allowed fields
      values: getAllKeys(values).reduce(
        (result, key) => {
          if (mergedAllow[key]) {
            result[key] = values[key]
          }
          return result
        },
        // Create a new object for the filtered `values` that keeps inheritance
        // intact. This is required by `setupHandlerFromObject()`, to support
        // `super` in handler functions.
        Object.create(Object.getPrototypeOf(values))
      ),
      allow: Object.keys(mergedAllow),
      authorize: mergedAuthorize
    }
  }

  async emitHook(type, handleResult, ctx, ...args) {
    let result = handleResult ? args.shift() : undefined
    for (const handler of this.listeners(type)) {
      if (handleResult) {
        const res = await handler.call(this, ctx, result, ...args)
        if (res !== undefined) {
          result = res
        }
      } else {
        await handler.call(this, ctx, ...args)
      }
    }
    return result
  }

  /**
   * Converts the authorize config settings into an authorization function that
   * can be passed to `handleAuthorization()`.
   *
   * @param {boolean|function|string|string[]} authorize the authorize config
   * settings
   * @return {function} the authorization function
   */
  processAuthorize(authorize) {
    if (authorize == null) {
      return () => true
    } else if (isBoolean(authorize)) {
      return () => authorize
    } else if (isFunction(authorize)) {
      return async (...args) => {
        const res = await authorize(...args)
        // Pass res through `processAuthorize()` to support strings & arrays.
        return this.processAuthorize(res)(...args)
      }
    } else if (isString(authorize) || isArray(authorize)) {
      return (ctx, member) => {
        const { user } = ctx.state
        return user && !!asArray(authorize).find(
          // Support 3 scenarios:
          // - '$self': The requested member is checked against `ctx.state.user`
          //   and the action is only authorized if it matches the member.
          // - '$owner': The member is asked if it is owned by `ctx.state.user`
          //   through the optional `Model.$hasOwner()` method.
          // - any string:  `ctx.state.user` is checked for this role through
          //   the overridable `UserModel.hasRole()` method.
          value => {
            return value === '$self'
              ? member
                // member actions
                ? member.$is(user)
                // collection actions: match id and modelClass
                : user.constructor === this.modelClass &&
                  // TODO: Shouldn't this use `ctx.memberId`?
                  `${user.id}` === ctx.params.id
              : value === '$owner'
                ? member?.$hasOwner?.(user)
                : user.$hasRole(value)
          }
        )
      }
    } else {
      throw new ControllerError(this,
        `Unsupported authorize setting: '${authorize}'`
      )
    }
  }

  describeAuthorize(authorize) {
    return isFunction(authorize)
      ? describeFunction(authorize)
      : isString(authorize)
        ? `'${authorize}'`
        : isArray(authorize)
          ? `[${authorize.map(value => `'${value}'`).join(', ')}]`
          : ''
  }

  async handleAuthorization(authorization, ...args) {
    const ok = await authorization(...args)
    if (ok !== true) {
      throw new AuthorizationError()
    }
  }

  log(str, indent = 0) {
    if (this.logging) {
      console.info(`${'  '.repeat(indent)}${str}`)
    }
  }
}

EventEmitter.mixin(Controller.prototype)

const inheritanceMap = new WeakMap()

function setupHandlerFromObject(object, actions) {
  const {
    handler,
    action,
    authorize,
    parameters,
    returns,
    scope,
    transacted
  } = object

  // In order to suport `super` calls in the `handler` function in object
  // notation, deploy this crazy JS sorcery:
  Object.setPrototypeOf(object, Object.getPrototypeOf(actions))

  handler.authorize = authorize
  handler.transacted = transacted

  if (action) {
    const [verb, path] = asArray(action)
    handler.verb = verb
    handler.path = path
  }

  if (parameters) {
    const [_parameters, options] = parameters
    const hasOptions = isArray(_parameters)
    handler.parameters = hasOptions ? _parameters : parameters

    // If validation options are provided, expose them through
    // `handler.options.parameters`, see ControllerAction
    if (hasOptions) {
      handler.options = {
        ...handler.options,
        parameters: options
      }
    }
  }

  if (returns) {
    const [_returns, options] = asArray(returns)
    handler.returns = _returns

    // If validation options are provided, expose them through
    // `handler.options.returns`, see ControllerAction
    if (options) {
      handler.options = {
        ...handler.options,
        parameters: options
      }
    }
  }

  if (scope) {
    handler.scope = asArray(scope)
  }

  return handler
}
