import Koa from 'koa'
import Knex from 'knex'
import util from 'util'
import chalk from 'chalk'
import fs from 'fs-extra'
import path from 'path'
import uuidv4 from 'uuid/v4'
import bodyParser from 'koa-bodyparser'
import cors from '@koa/cors'
import compose from 'koa-compose'
import compress from 'koa-compress'
import conditional from 'koa-conditional-get'
import multer from 'koa-multer'
import passport from 'koa-passport'
import session from 'koa-session'
import etag from 'koa-etag'
import helmet from 'koa-helmet'
import koaLogger from 'koa-logger'
import pinoLogger from 'koa-pino-logger'
import responseTime from 'koa-response-time'
import Router from '@ditojs/router'
import { Model, BelongsToOneRelation, knexSnakeCaseMappers } from 'objection'
import { EventEmitter } from '@/lib'
import { Controller } from '@/controllers'
import { Service } from '@/services'
import { convertSchema } from '@/schema'
import { ValidationError } from '@/errors'
import {
  handleError, findRoute, handleRoute, createTransaction, emitUserEvents
} from './middleware'
import SessionStore from './SessionStore'
import { Validator } from './Validator'
import {
  isObject, isString, asArray, isPlainObject, hyphenate, clone
} from '@ditojs/utils'

export class Application extends Koa {
  constructor(
    config = {},
    { validator, router, events, models, controllers, services }
  ) {
    super()
    this.setupEmitter(events)
    // Pluck keys out of `config.app` to keep them secret
    const { keys, ...app } = config.app || {}
    this.config = { ...config, app }
    this.keys = keys
    this.proxy = !!app.proxy
    this.validator = validator || new Validator()
    this.router = router || new Router()
    this.validator.app = this
    this.models = Object.create(null)
    this.services = Object.create(null)
    this.controllers = Object.create(null)
    this.storage = Object.create(null)
    this.hasControllerMiddleware = false
    this.setupGlobalMiddleware()
    this.setupKnex()
    if (config.storage) {
      this.setupStorage(config.storage)
    }
    if (models) {
      this.addModels(models)
    }
    if (services) {
      this.addServices(services)
    }
    if (controllers) {
      this.addControllers(controllers)
    }
  }

  addRoute(verb, path, transacted, handlers, controller = null, action = null) {
    handlers = asArray(handlers)
    const handler = handlers.length > 1 ? compose(handlers) : handlers[0]
    // Instead of directly passing `handler`, pass a `route` object that also
    // will be exposed through `ctx.route`, see `routerHandler()`:
    const route = {
      verb,
      path,
      transacted,
      handler,
      controller,
      action
    }
    this.router[verb](path, route)
  }

  addModels(models) {
    // First add all models then call initialize() for each in a second loop,
    // since they may be referencing each other in relations.
    for (const modelClass of Object.values(models)) {
      this.addModel(modelClass)
    }
    // Now (re-)sort all models based on their relations.
    this.models = this.sortModels(this.models)
    // Filter through all sorted models, keeping only the newly added ones.
    const sortedModels = Object.values(this.models).filter(
      modelClass => models[modelClass.name] === modelClass
    )
    // Initialize the added models in correct sorted sequence, so that for every
    // model, getRelatedRelations() returns the full list of relating relations.
    for (const modelClass of sortedModels) {
      if (models[modelClass.name] === modelClass) {
        modelClass.setup(this.knex)
        // Now that the modelClass is set up, call `initialize()`, which can be
        // overridden by sub-classes,without having to call `super.initialize()`
        modelClass.initialize()
        this.validator.addSchema(modelClass.getJsonSchema())
      }
    }
    const { log } = this.config
    if (log.schema || log.relations) {
      for (const modelClass of sortedModels) {
        const data = {}
        if (log.schema) {
          data.jsonSchema = modelClass.getJsonSchema()
        }
        if (log.relations) {
          data.relationMappings = clone(modelClass.relationMappings, value =>
            Model.isPrototypeOf(value) ? `[Model: ${value.name}]` : value
          )
        }
        console.log(
          chalk.yellow.bold(`\n${modelClass.name}:\n`),
          util.inspect(data, {
            colors: true,
            depth: null,
            maxArrayLength: null
          })
        )
      }
    }
  }

  addModel(modelClass) {
    if (Model.isPrototypeOf(modelClass)) {
      modelClass.app = this
      this.models[modelClass.name] = modelClass
    } else {
      throw new Error(`Invalid model class: ${modelClass}`)
    }
  }

  sortModels(models) {
    const sortByRelations = (list, collected = {}, excluded = {}) => {
      for (const modelClass of list) {
        const { name } = modelClass
        if (!collected[name] && !excluded[name]) {
          for (const relation of Object.values(modelClass.getRelations())) {
            if (!(relation instanceof BelongsToOneRelation)) {
              const { relatedModelClass, joinTableModelClass } = relation
              for (const related of [joinTableModelClass, relatedModelClass]) {
                // Exclude self-references and generated join models:
                if (related && related !== modelClass && models[related.name]) {
                  sortByRelations([related], collected, {
                    // Exclude modelClass to prevent endless recursions:
                    [name]: modelClass,
                    ...excluded
                  })
                }
              }
            }
          }
          collected[name] = modelClass
        }
      }
      return Object.values(collected)
    }
    // Return a new object with the sorted models as its key/value pairs.
    // NOTE: We need to reverse for the above algorithm to sort properly,
    // and then reverse the result back.
    return sortByRelations(Object.values(models).reverse()).reverse().reduce(
      (models, modelClass) => {
        models[modelClass.name] = modelClass
        return models
      },
      Object.create(null)
    )
  }

  getModel(name) {
    return this.models[name] ||
      !name.endsWith('Model') && this.models[`${name}Model`]
  }

  addServices(services) {
    for (const [name, service] of Object.entries(services)) {
      // Handle ES6 module weirdness that can happen, apparently:
      if (name === 'default' && isPlainObject(service)) {
        this.addServices(service)
      } else {
        this.addService(service, name)
      }
    }
  }

  addService(service, name) {
    // Auto-instantiate controller classes:
    if (Service.isPrototypeOf(service)) {
      // eslint-disable-next-line new-cap
      service = new service(this, name)
    }
    if (!(service instanceof Service)) {
      throw new Error(`Invalid service: ${service}`)
    }
    // Only after the constructor is called, `service.name` is guaranteed to be
    // set to the correct value, e.g. with an after-constructor class property.
    ({ name } = service)
    const config = this.config.services[name]
    if (config === undefined) {
      throw new Error(`Configuration missing for service '${name}'`)
    }
    // As a convention, the configuration of a service can be set to `false`
    // in order to entirely deactivate the service.
    if (config !== false) {
      service.setup(config)
      this.services[name] = service
      // Now that the service is set up, call `initialize()` which can be
      // overridden by services.
      service.initialize()
    }
  }

  getService(name) {
    return this.services[name]
  }

  async callServices(method, ...args) {
    return Promise.map(
      Object.values(this.services),
      service => service[method](...args)
    )
  }

  addControllers(controllers, namespace) {
    for (const [key, value] of Object.entries(controllers)) {
      if (isPlainObject(value)) {
        this.addControllers(value, namespace ? `${namespace}/${key}` : key)
      } else {
        this.addController(value, namespace)
      }
    }
  }

  addController(controller, namespace) {
    // Controllers require additional middleware to be installed once.
    this.setupControllerMiddleware()
    // Auto-instantiate controller classes:
    if (Controller.isPrototypeOf(controller)) {
      // eslint-disable-next-line new-cap
      controller = new controller(this, namespace)
    }
    if (!(controller instanceof Controller)) {
      throw new Error(`Invalid controller: ${controller}`)
    }
    // Inheritance of action methods cannot happen in the constructor itself,
    // so call separate `setup()` method after in order to take care of it.
    controller.setup()
    this.controllers[controller.url] = controller
    // Now that the controller is set up, call `initialize()` which can be
    // overridden by controllers.
    controller.initialize()
    // Each controller can also provide further middleware, e.g.
    // `AdminController`:
    const middleware = controller.compose()
    if (middleware) {
      this.use(middleware)
    }
  }

  getController(url) {
    return this.controllers[url]
  }

  setupStorage(config) {
    for (const [name, settings] of Object.entries(config)) {
      let storage = null
      if (isPlainObject(settings)) {
        const { dest, s3 } = settings
        if (dest) {
          storage = multer.diskStorage({
            destination(req, file, cb) {
              const uuid = uuidv4()
              file.filename = `${uuid}${path.extname(file.originalname)}`
              const dir = path.join(dest, uuid[0], uuid[1])
              fs.ensureDir(dir)
                .then(() => cb(null, dir))
                .catch(cb)
            },

            filename(req, file, cb) {
              cb(null, file.filename)
            }
          })
          storage.dest = dest
        } else if (s3) {
          // TODO: Implement multer-s3
          // storage.s3 = s3
        }
      } else if (isObject(settings)) {
        // Assume that this is already a multer storage instance.
        storage = settings
      }
      if (storage) {
        storage.name = name
        this.storage[name] = storage
      }
    }
  }

  getStorage(name) {
    return this.storage[name]
  }

  convertAsset(file) {
    // Convert multer-file object to our own file object format.
    // TODO: Figure out how to handle s3.
    return {
      mimeType: file.mimetype,
      destination: file.destination,
      fileName: file.filename,
      originalName: file.originalname,
      size: file.size
    }
  }

  convertAssets(files) {
    return files.map(
      file => this.convertAsset(file)
    )
  }

  getAssetPath(file, storageName) {
    // TODO: Figure out how to handle s3.
    const filePath = path.join(file.destination, file.fileName)
    // If the asset config is provided, make sure that the file actually
    // resides in its storage.
    const storage = this.getStorage(storageName)
    if (
      storage?.dest &&
      !path.resolve(filePath).startsWith(path.resolve(storage.dest))
    ) {
      return null
    }
    return filePath
  }

  async removeAsset(file, storageName) {
    // TODO: Figure out how to handle s3.
    const filePath = this.getAssetPath(file, storageName)
    if (filePath) {
      await fs.unlink(filePath)
      const removeIfEmpty = async dir => {
        if ((await fs.readdir(dir)).length === 0) {
          await fs.rmdir(dir)
        }
      }
      // Clean up nested folders created with first two chars of filename also:
      const dir = path.dirname(filePath)
      const parentDir = path.dirname(dir)
      await (removeIfEmpty(dir))
      await (removeIfEmpty(parentDir))
      return true
    }
    return false
  }

  async createAssets(files, storageName, trx) {
    const AssetModel = this.getModel('Asset')
    if (AssetModel) {
      const assets = files.map(file => ({
        fileName: file.fileName,
        file,
        storageName,
        refCount: 0
      }))
      return AssetModel
        .query(trx)
        .insert(assets)
    }
    return null
  }

  async changeAssetsRefCount(fileNames, increment, trx) {
    const AssetModel = this.getModel('Asset')
    if (AssetModel) {
      return AssetModel
        .query(trx)
        .increment('refCount', increment)
        .whereIn('fileName', fileNames)
    }
    return null
  }

  async releaseUnusedAssets(trx) {
    const AssetModel = this.getModel('Asset')
    if (AssetModel) {
      // TODO: Only remove old orphans, e.g. older than a day, to prevent
      // removing somebody else's fresh upload that wasn't referenced yet.
      const orphans = await AssetModel
        .query(trx)
        .where('refCount', 0)
      await Promise.map(
        orphans,
        ({ file, storageName }) => {
          try {
            this.removeAsset(file, storageName)
          } catch (error) {
            console.error(error)
          }
        }
      )
      // TODO: Only delete the ones found as orphans above! (collect fileNames?)
      await AssetModel
        .query(trx)
        .delete()
        .where('refCount', 0)
    }
    return null
  }

  async deleteAssets(fileNames, trx) {
    // TODO: This should work on model level, and reduce reference counts, see
    // changeAssetsRefCount() / releaseUnusedAssets()
    const AssetModel = this.getModel('Asset')
    if (AssetModel) {
      return AssetModel
        .query(trx)
        .delete()
        .whereIn('fileName', fileNames)
    }
    return null
  }

  normalizePath(path) {
    return this.config.app.normalizePaths ? hyphenate(path) : path
  }

  compileValidator(jsonSchema, options) {
    return jsonSchema
      ? this.validator.compile(jsonSchema, options)
      : null
  }

  compileParametersValidator(parameters, options = {}) {
    const list = []
    let properties = null
    const rootName = options.rootName || 'root'
    for (const param of asArray(parameters)) {
      const schema = isString(param) ? { type: param } : param
      list.push(schema)
      if (!(schema.member)) {
        const { name, type, ...rest } = schema
        properties = properties || {}
        properties[name || rootName] = type ? { type, ...rest } : rest
      }
    }
    // NOTE: If properties is null, schema and validate will become null too:
    const schema = convertSchema(properties, options)
    const validate = this.compileValidator(schema, {
      // For parameters, always coerce types, including arrays.
      coerceTypes: 'array',
      ...options
    })
    const ctx = {
      app: this,
      validator: this.validator,
      options
    }
    return {
      list,
      schema,
      rootName,
      validate: validate
        // Use `call()` to pass ctx as context to Ajv, see passContext:
        ? data => validate.call(ctx, data)
        : null
    }
  }

  createValidationError({ type, message, errors, options }) {
    return new ValidationError({
      type,
      message,
      errors: this.validator.parseErrors(errors, options)
    })
  }

  setupGlobalMiddleware() {
    const {
      log = {},
      app = {}
    } = this.config

    const logger = {
      console: koaLogger,
      true: koaLogger,
      // TODO: Implement logging to actual file instead of console for Pino.
      file: pinoLogger
    }[log.requests || log.request]
    // TODO: `log.request` is deprecated, remove later.

    this.use(handleError())
    if (app.responseTime !== false) {
      this.use(responseTime())
    }
    if (logger) {
      this.use(logger())
    }
    if (app.helmet !== false) {
      this.use(helmet())
    }
    if (app.cors !== false) {
      this.use(cors(isObject(app.cors) ? app.cors : {}))
    }
    if (app.compress) {
      this.use(compress(app.compress))
    }
    if (app.etag) {
      this.use(conditional())
      this.use(etag())
    }
  }

  setupControllerMiddleware() {
    // NOTE: This is not part of the automatic `setupGlobalMiddleware()` so that
    // apps can set up the static serving of assets before installing the
    // session and passport middleware. It is called from `addController()`.
    // Use a flag to only install the middleware once:
    if (!this.hasControllerMiddleware) {
      const { app = {} } = this.config
      // Sequence is important:
      // 1. body parser
      this.use(bodyParser())
      // 2. find route from routes installed by controllers.
      this.use(findRoute(this.router))
      // 3. respect transacted settings, create and handle transactions.
      this.use(createTransaction())
      // 4. session
      if (app.session) {
        const {
          modelClass,
          ...options
        } = isObject(app.session) ? app.session : {}
        if (modelClass) {
          // Create a ContextStore that resolved the specified model class,
          // uses it to persist and retrieve the session, and automatically
          // binds all db operations to `ctx.transaction`, if it is set.
          // eslint-disable-next-line new-cap
          options.ContextStore = SessionStore(modelClass)
        }
        this.use(session(options, this))
      }
      // 5. passport
      if (app.passport) {
        this.use(passport.initialize())
        if (app.session) {
          this.use(passport.session())
        }
        this.use(emitUserEvents())
      }
      // 6. finally handle the found route, or set status / allow accordingly.
      this.use(handleRoute())
      this.hasControllerMiddleware = true
    }
  }

  setupKnex() {
    let { knex, log } = this.config
    const snakeCaseOptions = knex.normalizeDbNames === true
      ? {}
      : knex.normalizeDbNames
    if (snakeCaseOptions) {
      knex = {
        ...knex,
        ...knexSnakeCaseMappers(snakeCaseOptions)
      }
    }
    this.knex = Knex(knex)
    if (log.sql) {
      this.setupKnexLogging()
    }
  }

  setupKnexLogging() {
    const startTimes = {}

    function trim(str, length = 1024) {
      return str.length > length
        ? `${str.substring(0, length - 3)}...`
        : str
    }

    function end(query, { response, error }) {
      const id = query.__knexQueryUid
      const diff = process.hrtime(startTimes[id])
      const duration = diff[0] * 1e3 + diff[1] / 1e6
      delete startTimes[id]
      const bindings = query.bindings.join(', ')
      console.log(
        chalk.yellow.bold('knex:sql'),
        chalk.cyan(trim(query.sql)),
        chalk.magenta(duration + 'ms'),
        chalk.gray(`[${trim(bindings)}]`),
        response
          ? chalk.green(trim(JSON.stringify(response)))
          : error
            ? chalk.red(trim(JSON.stringify(error)))
            : ''
      )
    }

    this.knex
      .on('query', query => {
        startTimes[query.__knexQueryUid] = process.hrtime()
      })
      .on('query-response', (response, query) => {
        end(query, { response })
      })
      .on('query-error', (error, query) => {
        end(query, { error })
      })
  }

  normalizeIdentifier(identifier) {
    return this.knex.client.wrapIdentifier(identifier).replace(/['`"]/g, '')
  }

  denormalizeIdentifier(identifier) {
    const obj = this.knex.client.postProcessResponse({ [identifier]: 1 })
    return Object.keys(obj)[0]
  }

  onError(err) {
    if (err.status !== 404 && !err.expose && !this.silent) {
      console.error(`${err.name}: ${err.toJSON
        ? JSON.stringify(err.toJSON(), null, '  ')
        : err.message || err}`
      )
      if (err.stack) {
        console.error(err.stack)
      }
    }
  }

  async start() {
    if (!this.listeners('error').length) {
      this.on('error', this.onError)
    }
    await this.emit('before:start')
    await this.callServices('start')
    const {
      server: { host, port },
      env
    } = this.config
    this.server = await new Promise((resolve, reject) => {
      const server = this.listen(port, host, () => {
        const { port } = server.address()
        console.log(
          `${env} server started at http://${host}:${port}`
        )
        resolve(server)
      })
      if (!server) {
        reject(new Error(`Unable to start server at http://${host}:${port}`))
      }
    })
    await this.emit('after:start')
  }

  async stop() {
    await this.emit('before:stop')
    this.server = await new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close(err => {
          if (err) {
            reject(err)
          } else {
            resolve(null)
          }
        })
      } else {
        reject(new Error('Server is not running'))
      }
    })
    await this.callServices('stop')
    await this.emit('after:stop')
  }

  async startOrExit() {
    try {
      await this.start()
    } catch (err) {
      this.onError(err)
      process.exit(-1)
    }
  }
}

// Override Koa's events with our own EventEmitter that adds support for
// asynchronous events.
EventEmitter.mixin(Application.prototype)
