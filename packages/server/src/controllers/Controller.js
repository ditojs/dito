import compose from 'koa-compose'
import Router from 'koa-router'
import chalk from 'chalk'
import { getOwnProperty, getAllKeys } from '@/utils'
import ControllerAction from './ControllerAction'
import {
  ResponseError, WrappedError, ControllerError, AuthorizationError
} from '@/errors'
import {
  isObject, isString, isArray, isBoolean, isFunction, asArray, pick
} from '@ditojs/utils'

export class Controller {
  constructor(app, namespace) {
    this.app = app
    this.namespace = this.namespace || namespace
    this.logging = this.app?.config.log.routes
    this.level = 0
  }

  initialize(isRoot = true, setupControllerObject = true) {
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
          namespace ? chalk.green(`${namespace}/`) : ''}${
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
    }
  }

  compose() {
    return compose(this.router
      ? [
        this.router.routes(),
        this.router.allowedMethods()
      ]
      : []
    )
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
      if (isFunction(value) && !['constructor', 'modelClass'].includes(key)) {
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

  processActions(actions) {
    if (!actions) return actions
    // Respect `allow` settings and clear action methods that aren't listed.
    // Also collect and expand `authorize` settings so that at the end, the
    // `actions` object contains an `authorize` object with valid settings
    // for all the defined actions.
    //
    // Rules:
    // - Own actions on action objects that don't define an `allow` array are
    //   automatically allowed. If an `allow` array is defined as well, then
    //   these own actions need to be explicitly listed.
    // - If no `allow` arrays are defined in the prototypal hierarchy, each
    //   level allows its own actions, and these are merged, except for those
    //   marked as `$core`, which need to be explicitly listed in `allow`.

    // NOTE: `handleAllow()` and `handleAuthorize()` are applied in sequence of
    // the `actions` inheritance, from sub-class to base-class.

    const mergedAllow = {}
    const mergedAuthorize = {}
    let hasOwnAllow = false

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
          if (key !== 'allow') {
            mergedAllow[key] = true
          }
        }
      }
    }

    const handleAuthorize = authorize => {
      const add = (key, value) => {
        // Since we're walking up in the inheritance change, only take on an
        // authorize setting for a given key if it wasn't already defined before
        if (isFunction(actions[key]) && !(key in mergedAuthorize)) {
          mergedAuthorize[key] = value
        }
      }
      if (isObject(authorize)) {
        for (const key in authorize) {
          add(key, authorize[key])
        }
      } else if (authorize != null) {
        // This is an actions-wide setting. Loop through all actions, not just
        // current ones, and apply to any action that doesn't already have one:
        for (const key in actions) {
          add(key, authorize)
        }
      }
    }

    // Process the `allow` and `authorize` settings in sequence of the `actions`
    // inheritance, from sub-class to base-class.
    let current = actions
    while (current !== Object.prototype && !current.hasOwnProperty('$core')) {
      handleAllow(getOwnProperty(current, 'allow'), current)
      handleAuthorize(getOwnProperty(current, 'authorize'))
      current = Object.getPrototypeOf(current)
    }

    // At the end of the chain, also support both settings on the controller-
    // level, and thus applied to all action objects in the controller.
    if (this.allow) {
      handleAllow(this.allow, actions)
    }
    if (this.authorize) {
      handleAuthorize(this.authorize)
    }

    // Convert to a new `values` object that explicitly lists allowed actions in
    // its `allow` array, including expansion of '*'. This is required for
    // proper inheritance of `allow` arrays.
    return getAllKeys(actions).reduce((result, key) => {
      if (key !== 'allow' && mergedAllow[key]) {
        result[key] = actions[key]
      }
      return result
    }, {
      allow: Object.keys(mergedAllow),
      authorize: mergedAuthorize
    })
  }

  processAuthorize(authorize) {
    if (isFunction(authorize)) {
      return async (ctx, ...args) => {
        const res = await authorize(ctx, ...args)
        // Pass res through `processAuthorize()` to support strings & arrays.
        return this.processAuthorize(res)(ctx, ...args)
      }
    } else if (isString(authorize) || isArray(authorize)) {
      return ctx => {
        return !!ctx.state.user?.hasRole(...asArray(authorize))
      }
    } else if (isBoolean(authorize)) {
      return () => authorize
    } else if (authorize == null) {
      return () => true
    } else {
      throw new ControllerError(this,
        `Unsupported authorize setting: '${authorize}'`
      )
    }
  }

  describeAuthorize(authorize) {
    if (isFunction(authorize)) {
      const match = authorize.toString().match(
        /^\s*(?:function[^(]*\(([^)]*)\)|\(([^)]*)\)\s*=>|(\S*)\s*=>)\s*(.)/
      )
      if (match) {
        const body = match[4] === '{' ? '{ ... }' : '...'
        return match[1] !== undefined ? `function (${match[1]}) ${body}`
          : match[2] !== undefined ? `(${match[2]}) => ${body}`
          : match[3] !== undefined ? `${match[3]} => ${body}`
          : ''
      }
    }
    return pick(authorize, '')
  }

  async handleAuthorization(authorize, ctx, args = []) {
    const ok = await authorize(ctx, ...args)
    if (ok !== true) {
      throw new AuthorizationError()
    }
  }

  setupActions(type) {
    const actions = this.processActions(this.inheritValues(type))
    const { authorize } = actions
    for (const name in actions) {
      const action = actions[name]
      if (isFunction(action)) {
        this.setupAction(type, name, action, authorize[name])
      }
    }
    return actions
  }

  setupAction(type, name, action, authorize) {
    this.setupRoute(
      type,
      action.verb || 'get',
      action.path || this.app.normalizePath(name),
      authorize,
      new ControllerAction(this, action, authorize)
    )
  }

  setupRoute(type, verb, path, authorize, controllerAction) {
    const url = this.getUrl(type, path)
    this.log(
      `${
        chalk.magenta(verb.toUpperCase())} ${
        chalk.white(url)} ${
        chalk.gray(this.describeAuthorize(authorize))
      }`,
      this.level + 1
    )
    if (!this.router) {
      this.router = new Router()
    }
    this.router[verb](url, async ctx => {
      try {
        const res = await controllerAction.callAction(ctx)
        if (res !== undefined) {
          ctx.body = res
        }
      } catch (err) {
        throw err instanceof ResponseError ? err : new WrappedError(err)
      }
    })
  }

  log(str, indent = 0) {
    if (this.logging) {
      console.log(`${'  '.repeat(indent)}${str}`)
    }
  }
}

const inheritanceMap = new WeakMap()
