import compose from 'koa-compose'
import Router from 'koa-router'
import multer from 'koa-multer'
import chalk from 'chalk'
import { getOwnProperty, getAllKeys, describeFunction } from '@/utils'
import { EventEmitter } from '@/lib'
import ControllerAction from './ControllerAction'
import MemberAction from './MemberAction'
import {
  ResponseError, WrappedError, ControllerError, AuthorizationError
} from '@/errors'
import {
  isObject, isString, isArray, isBoolean, isFunction, asArray, parseDataPath
} from '@ditojs/utils'

export class Controller {
  constructor(app, namespace) {
    this.app = app
    this.namespace = this.namespace || namespace
    this.logging = this.app.config.log.routes
    this.level = 0
  }

  initialize() {
    // Overridable in sub-classes
  }

  setup(isRoot = true, setupControllerObject = true) {
    this.setupEmitter(this.hooks)
    // If the class name ends in 'Controller', remove it from controller name.
    this.name = this.name ||
      this.constructor.name.match(/^(.*?)(?:Controller|)$/)[1]
    if (this.path === undefined) {
      this.path = this.app.normalizePath(this.name)
    }
    if (isRoot) {
      const { path, namespace } = this
      const url = path ? `/${path}` : ''
      this.url = namespace ? `/${namespace}${url}` : url
      this.log(
        `${
          namespace ? chalk.green(`/${namespace}/`) : ''}${
          chalk.cyan(path)}${
          chalk.white(':')
        }`,
        this.level
      )
      this.router = null
      if (setupControllerObject) {
        this.controller = this.reflectControllerObject()
        // Now that the instance fields are reflected in the `controller` object
        // we can use the normal inheritance mechanism through `setupActions()`:
        this.controller = this.setupActions('controller')
      }
      this.upload = this.setupUpload()
    }
  }

  compose() {
    const middleware = [
      (ctx, next) => {
        // Expose the handling controller through `ctx.state`.
        ctx.state.controller = this
        return next()
      }
    ]
    if (this.router) {
      middleware.push(
        this.router.routes(),
        this.router.allowedMethods()
      )
    }
    return compose(middleware)
  }

  reflectControllerObject() {
    // On base controllers, the actions can be defined directly in the class
    // instead of inside an actions object, as is done with model and relation
    // controllers. But in order to use the same structure for inheritance as
    // these other controllers, we reflect these instance fields in a separate
    // `controller` object.
    const { allow } = this
    const controller = allow ? { allow } : {}

    const addAction = key => {
      const value = this[key]
      // NOTE: Only add instance methods that have a @action() decorator,
      // which in turn sets the `verb` property on the method:
      if (isFunction(value) && value.verb) {
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

  getPath(type, path) {
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
    // set to an empty object so inheritance can be set up and `filterValues()`
    // can still be called.
    // NOTE: We can't check with `this.hasOwnProperty(type)` because the
    // field can be on the class prototype as well, in case of accessors.
    const parentValues = entry[type]
    let currentValues = this[type]
    if (currentValues && currentValues === parentValues) {
      currentValues = this[type] = {}
    }
    // Combine parentValues and currentValues with correct inheritance.
    return parentValues
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
        // Since we're walking up in the inheritance change, only take on an
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
        // This is an values-wide setting. Loop through all values, not just
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
        {}
      ),
      allow: Object.keys(mergedAllow),
      authorize: mergedAuthorize
    }
  }

  async emitHook(type, ctx, result) {
    for (const handler of this.listeners(type)) {
      const res = await handler.call(this, ctx, result)
      if (res !== undefined) {
        result = res
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

  async handleAuthorization(authorization, ...args) {
    const ok = await authorization(...args)
    if (ok !== true) {
      throw new AuthorizationError()
    }
  }

  setupRoute(url, verb, authorize, handlers) {
    const authorizeStr = isFunction(authorize)
      ? describeFunction(authorize)
      : isString(authorize)
        ? `'${authorize}'`
        : isArray(authorize)
          ? `[${authorize.map(value => `'${value}'`).join(', ')}]`
          : ''
    this.log(
      `${
        chalk.magenta(verb.toUpperCase())} ${
        chalk.green(this.url)}${
        chalk.cyan(url.substring(this.url.length))} ${
        chalk.white(authorizeStr)
      }`,
      this.level + 1
    )
    if (!this.router) {
      this.router = new Router()
    }
    this.router[verb](url, ...handlers)
  }

  setupActions(type) {
    const {
      values: actions,
      authorize
    } = this.processValues(this.inheritValues(type))
    for (const name in actions) {
      this.setupAction(type, name, actions[name], authorize[name])
    }
    return actions
  }

  setupAction(type, name, handler, authorize) {
    // Custom member actions have their own class so they can fetch the members
    // ahead of their call.
    const ActionClass = type === 'member' ? MemberAction : ControllerAction
    // The default path for actions is the normalized name.
    const path = this.app.normalizePath(name)
    this.setupActionRoute(
      type,
      new ActionClass(this, handler, type, name, 'get', path, authorize)
    )
  }

  setupActionRoute(type, action) {
    const url = this.getUrl(type, action.path)
    this.setupRoute(url, action.verb, action.authorize, [
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

  setupUpload() {
    const {
      values,
      authorize
    } = this.processValues(this.inheritValues('upload'))
    return values
      ? Object.entries(values).reduce(
        (upload, [key, value]) => {
          // Convert dataPath to '/'-notation.
          const dataPath = parseDataPath(key).join('/')
          // Collect the converted configuration, so that from here on out, the
          // object notation can be assumed, see: `getUploadConfig()`
          upload[dataPath] = this.setupUploadRoute(
            dataPath,
            value,
            authorize[key]
          )
          return upload
        },
        {}
      )
      : null
  }

  getUploadConfig(dataPath) {
    return this.upload?.[dataPath] || null
  }

  setupUploadRoute(dataPath, config = {}, authorize) {
    if (isString(config)) {
      config = {
        storage: config
      }
    }
    const {
      storage: storageName,
      ...settings
    } = config
    const storage = this.app.getStorage(storageName)
    if (!storage) {
      throw new ControllerError(this,
        `Unknown storage configuration: '${storageName}'`
      )
    }
    const url = this.getUrl('controller', `upload/${dataPath}`)
    const upload = multer({
      storage
    })
    const authorization = this.processAuthorize(authorize)
    this.setupRoute(url, 'post', authorize, [
      async (ctx, next) => {
        await this.handleAuthorization(authorization, ctx)
        // Give the multer callbacks access to `ctx` through `req`.
        ctx.req.ctx = ctx
        return next()
      },

      upload.fields([{
        ...settings,
        name: dataPath
      }]),

      async (ctx, next) => {
        const files = this.app.convertUploads(ctx.req.files[dataPath])
        await this.app.rememberUploads(this.url, dataPath, files)
        ctx.body = files
        return next()
      }
    ])
    return config
  }

  log(str, indent = 0) {
    if (this.logging) {
      console.log(`${'  '.repeat(indent)}${str}`)
    }
  }
}

EventEmitter.mixin(Controller.prototype)

const inheritanceMap = new WeakMap()
