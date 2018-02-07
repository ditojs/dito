import compose from 'koa-compose'
import Router from 'koa-router'
import chalk from 'chalk'
import { Model } from 'objection'
import { isFunction, asArray } from '@ditojs/utils'
import { ResponseError, WrappedError } from '@/errors'
import ControllerAction from './ControllerAction'

export class Controller {
  constructor(app, namespace) {
    this.app = app
    this.namespace = this.namespace || namespace
    this.logging = this.app?.config.log.routes
    this.level = 0
  }

  initialize(isRoot = true) {
    this.name = this.name ||
      this.constructor.name.match(/^(.*?)(?:Controller|)$/)[1]
    this.path = this.path || this.app.normalizePath(this.name)
    const { path, namespace } = this
    if (isRoot) {
      this.url = namespace ? `/${namespace}/${path}` : `/${path}`
      this.log(
        `${namespace && chalk.green(`${namespace}/`)}${
          chalk.cyan(this.name)}${chalk.white(':')}`,
        this.level
      )
      this.router = new Router()
      this.controller = this.setupActions('controller')
    }
  }

  get controller() {
    // On base controllers, the actions can be defined directly in the class
    // instead of inside an actions object as is done with model and relation
    // controllers. But in order to use the same structure for inheritance as
    // these other controllers, we emulate a `controller` accessor that reflects
    // these instance fields in a separate object. This accessor has a setter,
    // so that if it is set in a sub-class, the overridden value is used.
    if (!this._controller) {
      this._controller = {}

      const collect = key => {
        const action = this[key]
        if (key !== 'constructor' &&
            isFunction(action) &&
            !(action.prototype instanceof Model)) {
          this._controller[key] = action
        }
      }

      // Use `Object.getOwnPropertyNames()` to get the fields in order to not
      // also receive values from parents (those are fetched later in
      // `inheritValues()`, see `getParentValues()`).
      // As a rule of thumb: Any prototype that defines `initialize()` is part
      // of a core class and does not need to be inspected for fields. If the
      // prototype doesn't define the method, it must be an extended class.
      const proto = Object.getPrototypeOf(this)
      if (!proto.hasOwnProperty('initialize')) {
        Object.getOwnPropertyNames(proto).forEach(collect)
      }
      Object.getOwnPropertyNames(this).forEach(collect)
    }
    return this._controller
  }

  set controller(controller) {
    this._controller = controller
  }

  compose() {
    return compose([
      this.router.routes(),
      this.router.allowedMethods()
    ])
  }

  getPath(type, path) {
    return path
  }

  getUrl(type, path) {
    path = this.getPath(type, path)
    return path && path !== '/' ? `${this.url}/${path}` : this.url
  }

  filterValues(values) {
    // Respect `allow` settings and clear any default method to deactivate it:
    if (values?.allow) {
      const allow = asArray(values.allow)
      for (const key in values) {
        if (!allow.includes(key) && key !== 'allow') {
          values[key] = undefined
        }
      }
    }
    return values
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
        instance: new parentClass()
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
    // If there are no values defined on `this`, create an empty object so
    // inheritance can be set up and `filterValues()` can still be called.
    const currentValues =
      this.hasOwnProperty(type) && this[type] || (this[type] = {})
    const parentValues = entry[type]
    // Combine parentValues and currentValues with correct inheritance.
    const values = parentValues
      ? Object.setPrototypeOf(currentValues, parentValues)
      : currentValues
    return this.filterValues(values)
  }

  setupActions(type) {
    const actions = this.inheritValues(type)
    for (const name in actions) {
      const action = actions[name]
      if (isFunction(action)) {
        this.setupAction(type, action, name)
      }
    }
    return actions
  }

  setupAction(type, action, name) {
    this.setupRoute(
      type,
      action.verb || 'get',
      action.path || this.app.normalizePath(name),
      new ControllerAction(this, action)
    )
  }

  setupRoute(type, verb, path, controllerAction) {
    const url = this.getUrl(type, path)
    this.log(
      `${chalk.magenta(verb.toUpperCase())} ${chalk.white(url)}`,
      this.level + 1
    )
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
