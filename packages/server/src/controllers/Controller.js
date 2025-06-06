import pico from 'picocolors'
import { EventEmitter } from '../lib/index.js'
import ControllerAction from './ControllerAction.js'
import MemberAction from './MemberAction.js'
import {
  ResponseError,
  ControllerError,
  AuthorizationError
} from '../errors/index.js'
import {
  getOwnProperty,
  getOwnKeys,
  getAllKeys,
  getInheritanceChain
} from '../utils/object.js'
import { processHandlerParameters } from '../utils/handler.js'
import { describeFunction } from '../utils/function.js'
import { formatJson } from '../utils/json.js'
import {
  isObject,
  isString,
  isArray,
  isBoolean,
  isFunction,
  asArray,
  equals,
  parseDataPath,
  normalizeDataPath,
  deprecate
} from '@ditojs/utils'

export class Controller {
  name = null
  path = null
  url = null
  assets = null
  actions = null
  transacted = null
  initialized = false

  constructor(app, namespace) {
    this.app = app
    this.namespace = namespace
    this.logRoutes = this.app.config.log.routes
    this.level = 0
  }

  // `configure()` is called right after the constructor, but before `setup()`
  // which sets up the actions and routes, and the custom `async initialize()`.
  // @overridable
  configure() {
    const hooks = this.inheritValues('hooks')
    // Collect callbacks from the full inheritance chain of the hooks, so that
    // the callbacks from base classes are also run. And reverse the chain so
    // that the base class callbacks are run first.
    const chain = getInheritanceChain(hooks).reverse()
    const keys = Object.keys(Object.assign({}, hooks, ...chain))
    const events = Object.fromEntries(
      keys.map(event => [
        event,
        chain
          .map(hooks => (hooks.hasOwnProperty(event) ? hooks[event] : null))
          .filter(Boolean)
      ])
    )
    this._configureEmitter(events, {
      // Support wildcard hooks only on controllers:
      wildcard: true
    })
    // If the class name ends in 'Controller', remove it from controller name.
    this.name ||= this.constructor.name.match(/^(.*?)(?:Controller|)$/)[1]
    this.path ??= this.app.normalizePath(this.name)
    const { path, namespace } = this
    // TODO: The distinction between  `url` and `path` is a bit tricky, since
    // what we call `url` here is called `path` in Router, and may contain
    // mapped parameters or wildcards. Consider `path` / `route` instead?
    const url = path ? `/${path}` : ''
    this.url = namespace ? `/${namespace}${url}` : url
  }

  // @overridable
  setup() {
    this.logController()
    // Now that the instance fields are reflected in the `controller` object
    // we can use the normal inheritance mechanism through `setupActions()`:
    this.setProperty('actions', this.setupActions('actions'))
    this.setProperty('assets', this.setupAssets())
  }

  // @overridable
  async initialize() {
    // To be overridden in sub-classes, if the controller needs to initialize.
  }

  // @return {Application|Function} [app or function]
  // @overridable
  compose() {
    // To be overridden in sub-classes, if the controller needs to install
    // middleware. For normal routes, use `this.app.addRoute()` instead.
  }

  // @overridable
  logController() {
    const { path, namespace } = this
    this.logRoute(
      `${
        namespace ? pico.green(`/${namespace}/`) : ''
      }${
        pico.cyan(path)
      }${
        pico.white(':')
      }`,
      this.level
    )
  }

  setProperty(key, value) {
    Object.defineProperty(this, key, {
      value,
      writable: false,
      enumerable: true,
      configurable: true
    })
  }

  logRoute(str, indent = 0) {
    if (this.logRoutes) {
      console.info(`${'  '.repeat(indent)}${str}`)
    }
  }

  // Only use this method to get a logger instance that is bound to the context,
  // otherwise use the cached getter.
  getLogger(ctx) {
    const logger = ctx?.logger ?? this.app.logger
    return logger.child({ name: this.name })
  }

  get logger() {
    const value = this.getLogger()
    Object.defineProperty(this, 'logger', { value })
    return value
  }

  markAsCoreActions(actions) {
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

  setupRoute(method, url, transacted, authorize, action, middlewares) {
    this.logRoute(
      `${
        pico.magenta(method.toUpperCase())
      } ${
        pico.green(this.url)
      }${
        pico.cyan(url.slice(this.url.length))
      } ${
        pico.white(this.describeAuthorize(authorize))
      }`,
      this.level + 1
    )
    this.app.addRoute(method, url, transacted, middlewares, this, action)
  }

  setupActions(type) {
    const {
      values: actions,
      authorize
    } = this.processValues(this.inheritValues(type))
    if (actions) {
      for (const [name, action] of Object.entries(actions)) {
        // Replace the action object with the converted action handler, so they
        // too can benefit from prototypal inheritance:
        actions[name] = this.setupAction(
          type,
          actions,
          name,
          action,
          authorize[name]
        )
      }
      // Expose a direct reference to the controller on the action object, but
      // also make it inherit from the controller so that all its public fields
      // and functions (`app`, `query()`, `execute()`, etc.) can be accessed
      // directly through `this` from actions.
      // NOTE: Inheritance is also set up by `inheritValues()` so that from the
      // handlers, `super` points to the parent controller's actions object, so
      // that calling `super.patch()` from a patch handler magically works.
      actions.controller = this
      Object.setPrototypeOf(actions, this)
    }
    return actions
  }

  setupAction(type, actions, name, action, authorize) {
    const handler = isFunction(action)
      ? action
      : isObject(action)
        ? convertActionObject(name, action, actions)
        : null
    // Action naming convention: `'<method> <path>'`, or just `'<method>'` for
    // the default methods.
    let [method, path = ''] = name.split(' ')
    if (!isMethodAction(method)) {
      path = name
    }
    // Custom member actions have their own class so they can fetch the members
    // ahead of their call.
    const actionClass = type === 'member' ? MemberAction : ControllerAction
    this.setupActionRoute(
      type,
      // eslint-disable-next-line new-cap
      new actionClass(
        this,
        actions,
        handler,
        type,
        name,
        method,
        path,
        authorize
      )
    )
    return handler
  }

  setupActionRoute(type, action) {
    const url = this.getUrl(type, action.path)
    const { method, transacted, authorize } = action
    this.setupRoute(method, url, transacted, authorize, action, [
      async ctx => {
        try {
          const res = await action.callAction(ctx)
          if (res !== undefined) {
            ctx.body = res
          }
        } catch (err) {
          throw err instanceof ResponseError ? err : new ResponseError(err)
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
      throw new ControllerError(
        this,
        `Unknown storage configuration: '${storageName}'`
      )
    }
    const tokens = parseDataPath(dataPath)
    const getDataPath = callback => normalizeDataPath(tokens.map(callback))

    const normalizedPath = getDataPath(
      // Router supports both shallow & deep wildcards, no normalization needed.
      token =>
        token === '*' || token === '**'
          ? token
          : this.app.normalizePath(token)
    )

    // Convert `dataPath` to a regular expression to match field names
    // against, but convert wildcards (*) to match both numeric ids and words,
    // e.g. 'create':
    const matchDataPath = new RegExp(
      `^${
        getDataPath(
          // Use the exact same regexps as in `Router`:
          token =>
            token === '*'
              ? '[^/]+' // shallow wildcard
              : token === '**'
                ? '.+?' // deep wildcard
                : token
        )
      }$`
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
    // `controller` (`Controller`), `collection`, `member` (`ModelController`,
    // `RelationController`), `relation` (`RelationController`), and sets up an
    // inheritance chain for it that goes all the way up to it base class (e.g.
    // `CollectionController`), so that the default definitions for all HTTP
    // methods can be inherited and overridden while using `super.<action>()`.
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

    let allowMap = {}
    const authorizeMap = {}

    const includeKey = key => !['allow', 'authorize'].includes(key)

    const handleAllow = (allow, current) => {
      const getFilteredMap = keys =>
        Object.fromEntries(keys.filter(includeKey).map(key => [key, true]))

      if (allow) {
        // The controller action object provides its own allow setting:
        // - Clear whatever has been collected in `mergedAllow` so far
        // - Merge the `allow` setting with all the own keys of the object,
        //   unless:
        // - If the allow setting includes '*', allow all keys of the object,
        //   even the inherited ones.
        let keys = asArray(allow)
        if (keys.includes('*')) {
          keys = getAllKeys(current)
        } else {
          keys = [
            ...keys,
            ...getOwnKeys(current)
          ]
        }
        allowMap = getFilteredMap(keys) // Clear previous keys by overriding.
      } else {
        // The controller action object does not provide its own allow setting,
        // so add its own keys to the already allowed inherited keys so far.
        Object.assign(allowMap, getFilteredMap(getOwnKeys(current)))
      }
    }

    const handleAuthorize = authorize => {
      const add = (key, value) => {
        if (key in values && includeKey(key)) {
          authorizeMap[key] = value
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

    // Process the `allow` and `authorize` settings in reversed sequence of the
    // `values` inheritance, from base-class to sub-class.
    const chain = []
    let current = values
    while (current !== Object.prototype && !current.hasOwnProperty('$core')) {
      chain.unshift(current)
      current = Object.getPrototypeOf(current)
    }

    for (const current of chain) {
      handleAllow(getOwnProperty(current, 'allow'), current)
      handleAuthorize(getOwnProperty(current, 'authorize'))
    }

    // At the end of the chain, also support authorize settings on the
    // controller-level, and thus applied to all action objects in the
    // controller.
    if (this.authorize) {
      handleAuthorize(this.authorize)
    }

    return {
      // Create a filtered `values` object that only contains the allowed fields
      values: getAllKeys(values).reduce(
        (result, key) => {
          if (allowMap[key]) {
            result[key] = values[key]
          }
          return result
        },
        // Create a new object for the filtered `values` that keeps inheritance
        // intact. This is required by `convertActionObject()`, to support
        // `super` in handler functions.
        Object.create(Object.getPrototypeOf(values))
      ),
      allow: Object.keys(allowMap),
      authorize: authorizeMap
    }
  }

  async emitHook(type, handleResult, ctx, ...args) {
    let result = handleResult ? args.shift() : undefined
    for (const listener of this.listeners(type)) {
      if (handleResult) {
        const res = await listener.call(this, ctx, result, ...args)
        if (res !== undefined) {
          result = res
        }
      } else {
        await listener.call(this, ctx, ...args)
      }
    }
    return result
  }

  async getMember(/* ctx, base = this, param = { ... } */) {
    // This is only defined in `CollectionController`, where it resolves to the
    // member represented by the given route.
    return null
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
      return async (ctx, member) => {
        const res = await authorize(ctx, member)
        // Pass res through `processAuthorize()` to support strings & arrays.
        return this.processAuthorize(res)(ctx, member)
      }
    } else if (isString(authorize) || isArray(authorize)) {
      return async (ctx, member) => {
        const { user } = ctx.state
        if (!user) {
          return false
        }
        const values = asArray(authorize)
        // For '$owner', fetch `member` now in case the action parameters
        // didn't already request it:
        if (!member && values.includes('$owner')) {
          member = await this.getMember(ctx)
        }
        return !!values.find(
          // Support 3 scenarios:
          // - '$self': The requested member is checked against `ctx.state.user`
          //   and the action is only authorized if it matches the member.
          // - '$owner': The member is asked if it is owned by `ctx.state.user`
          //   through the optional `Model.$hasOwner()` method.
          // - any string:  `ctx.state.user` is checked for this role through
          //   the overridable `UserModel.hasRole()` method.
          value => {
            return value === '$self'
              ? user.constructor === this.modelClass &&
                equals(user.$id(), ctx.memberId)
              : value === '$owner'
                ? member?.$hasOwner?.(user)
                : user.$hasRole(value)
          }
        )
      }
    } else {
      throw new ControllerError(
        this,
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

  async handleAuthorization(authorization, ctx, member) {
    const ok = await authorization(ctx, member)
    if (ok !== true) {
      throw new AuthorizationError()
    }
  }
}

EventEmitter.mixin(Controller.prototype)

const inheritanceMap = new WeakMap()

function convertActionObject(name, object, actions) {
  const {
    handler,
    action,
    authorize,
    transacted,
    scope,
    parameters,
    // TODO: `returns` was deprecated in May 2025 in favour of `response`.
    // Remove this in 2026.
    returns,
    response = returns,
    ...rest
  } = object

  if (returns) {
    deprecate(
      'The `returns` property is deprecated in favour of `response`. ' +
      'Update your handler definition to use `response` instead.'
    )
  }

  // In order to support `super` calls in the `handler` function in object
  // notation, deploy this crazy JS sorcery:
  Object.setPrototypeOf(object, Object.getPrototypeOf(actions))

  if (!handler) {
    throw new Error(
      `Missing handler in '${name}' action: ${formatJson(object)}`
    )
  }

  handler.authorize = authorize ?? null
  handler.transacted = transacted ?? null
  handler.scope = scope ? asArray(scope) : null

  processHandlerParameters(handler, 'parameters', parameters)
  processHandlerParameters(handler, 'response', response)

  return Object.assign(handler, rest)
}

function isMethodAction(name) {
  return (
    {
      get: true,
      delete: true,
      post: true,
      put: true,
      patch: true,
      head: true,
      options: true,
      trace: true,
      connect: true
    }[name] ||
    false
  )
}
