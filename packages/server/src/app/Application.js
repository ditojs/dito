import os from 'os'
import path from 'path'
import util from 'util'
import zlib from 'zlib'
import fs from 'fs-extra'
import Koa from 'koa'
import Knex from 'knex'
import axios from 'axios'
import pico from 'picocolors'
import pino from 'pino'
import parseDuration from 'parse-duration'
import bodyParser from 'koa-bodyparser'
import cors from '@koa/cors'
import compose from 'koa-compose'
import compress from 'koa-compress'
import conditional from 'koa-conditional-get'
import mount from 'koa-mount'
import passport from 'koa-passport'
import session from 'koa-session'
import etag from 'koa-etag'
import helmet from 'koa-helmet'
import responseTime from 'koa-response-time'
import Router from '@ditojs/router'
import {
  isArray, isObject, isString, asArray, isPlainObject, isModule,
  hyphenate, clone, merge, parseDataPath, normalizeDataPath, toPromiseCallback
} from '@ditojs/utils'
import SessionStore from './SessionStore.js'
import { Validator } from './Validator.js'
import { EventEmitter } from '../lib/index.js'
import { Controller, AdminController } from '../controllers/index.js'
import { Service } from '../services/index.js'
import { Storage } from '../storage/index.js'
import { convertSchema } from '../schema/index.js'
import { formatJson } from '../utils/index.js'
import {
  ResponseError,
  ValidationError,
  DatabaseError,
  AssetError
} from '../errors/index.js'
import {
  attachLogger,
  createTransaction,
  findRoute,
  handleError,
  handleRoute,
  handleUser,
  logRequests
} from '../middleware/index.js'
import {
  Model,
  BelongsToOneRelation,
  knexSnakeCaseMappers,
  ref
} from 'objection'

export class Application extends Koa {
  constructor({
    config = {},
    validator,
    router,
    events,
    middleware,
    models,
    services,
    controllers
  } = {}) {
    super()
    this._setupEmitter(events)
    const {
      // Pluck keys out of `config.app` to keep them secret
      app: { keys, ...app } = {},
      log = {},
      ...rest
    } = config
    this.config = {
      app,
      log: log.silent || process.env.DITO_SILENT ? {} : log,
      ...rest
    }
    this.keys = keys
    this.proxy = !!app.proxy
    this.validator = validator || new Validator()
    this.router = router || new Router()
    this.validator.app = this
    this.storages = Object.create(null)
    this.models = Object.create(null)
    this.services = Object.create(null)
    this.controllers = Object.create(null)
    this.server = null
    this.isRunning = false

    this.setupLogger()
    this.setupKnex()
    this.setupMiddleware(middleware)

    if (config.storages) {
      this.addStorages(config.storages)
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

  addRoute(
    method, path, transacted, middlewares, controller = null, action = null
  ) {
    middlewares = asArray(middlewares)
    const middleware = middlewares.length > 1
      ? compose(middlewares)
      : middlewares[0]
    // Instead of directly passing `handler`, pass a `route` object that also
    // will be exposed through `ctx.route`, see `routerHandler()`:
    const route = {
      method,
      path,
      transacted,
      middleware,
      controller,
      action
    }
    if (!(method in this.router)) {
      throw new Error(
        `Unsupported HTTP method '${method}' in route '${path}'`
      )
    }
    this.router[method](path, route)
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
        const shouldLog = option => (
          option === true ||
          asArray(option).includes(modelClass.name)
        )
        const data = {}
        if (shouldLog(log.schema)) {
          data.schema = modelClass.getJsonSchema()
        }
        if (shouldLog(log.relations)) {
          data.relations = clone(modelClass.relationMappings, value =>
            Model.isPrototypeOf(value) ? `[Model: ${value.name}]` : value
          )
        }
        if (Object.keys(data).length > 0) {
          console.info(
            pico.yellow(pico.bold(`\n${modelClass.name}:\n`)),
            util.inspect(data, {
              colors: true,
              depth: null,
              maxArrayLength: null
            })
          )
        }
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
    return (
      this.models[name] ||
      !name.endsWith('Model') && this.models[`${name}Model`] ||
      null
    )
  }

  findModel(callback) {
    return Object.values(this.models).find(callback)
  }

  addServices(services) {
    for (const [name, service] of Object.entries(services)) {
      this.addService(service, name)
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
    return this.services[name] || null
  }

  findService(callback) {
    return Object.values(this.services).find(callback)
  }

  addControllers(controllers, namespace) {
    for (const [key, value] of Object.entries(controllers)) {
      if (isModule(value) || isPlainObject(value)) {
        this.addControllers(value, namespace ? `${namespace}/${key}` : key)
      } else {
        this.addController(value, namespace)
      }
    }
  }

  addController(controller, namespace) {
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
    // Each controller can also compose their own middleware (or app), e.g. as
    // used in `AdminController`:
    const composed = controller.compose()
    if (composed) {
      this.use(mount(controller.url, composed))
    }
  }

  getController(url) {
    return this.controllers[url] || null
  }

  findController(callback) {
    return Object.values(this.controllers).find(callback)
  }

  getAdminController() {
    return this.findController(
      controller => controller instanceof AdminController
    )
  }

  getAdminViteConfig(config) {
    return this.getAdminController()?.getViteConfig(config) || null
  }

  getAssetConfig({
    models = Object.keys(this.models),
    normalizeDbNames = this.config.knex.normalizeDbNames
  } = {}) {
    const assetConfig = {}
    for (const modelName of models) {
      const modelClass = this.models[modelName]
      const { assets } = modelClass.definition
      if (assets) {
        const normalizedModelName = normalizeDbNames
          ? this.normalizeIdentifier(modelName)
          : modelName
        const convertedAssets = {}
        for (const [assetDataPath, config] of Object.entries(assets)) {
          const {
            property,
            nestedDataPath,
            name,
            index
          } = modelClass.getPropertyOrRelationAtDataPath(assetDataPath)
          if (property && index === 0) {
            const normalizedName = normalizeDbNames
              ? this.normalizeIdentifier(name)
              : name
            const dataPath = normalizeDataPath([
              normalizedName,
              ...parseDataPath(nestedDataPath)
            ])
            const assetConfigs = convertedAssets[normalizedName] ||= {}
            assetConfigs[dataPath] = config
          } else {
            throw new Error('Nested graph properties are not supported yet')
          }
        }
        assetConfig[normalizedModelName] = convertedAssets
      }
    }
    return assetConfig
  }

  addStorages(storages) {
    for (const [name, config] of Object.entries(storages)) {
      this.addStorage(config, name)
    }
  }

  addStorage(config, name) {
    let storage = null
    if (isPlainObject(config)) {
      const storageClass = Storage.get(config.type)
      if (!storageClass) {
        throw new Error(`Unsupported storage: ${config}`)
      }
      // eslint-disable-next-line new-cap
      storage = new storageClass(this, config)
    } else if (config instanceof Storage) {
      storage = config
    }
    if (storage) {
      if (name) {
        storage.name = name
      }
      this.storages[storage.name] = storage
    }
    return storage
  }

  getStorage(name) {
    return this.storages[name] || null
  }

  compileValidator(jsonSchema, options) {
    return jsonSchema
      ? this.validator.compile(jsonSchema, options)
      : null
  }

  compileParametersValidator(parameters, options = {}) {
    const list = []
    const { dataName = 'data' } = options

    let properties = null
    const addParameter = (name, schema) => {
      list.push({
        name: name ?? null,
        ...schema
      })
      if (!schema.member) {
        properties ||= {}
        properties[name || dataName] = schema
      }
    }

    // Support two formats of parameters definitions:
    // - An array of parameter schemas, named by their `name` key.
    // - An object of parameter schemas, named by the key under which each
    //   schema is stored in the root object.
    // If an array is passed, then the controller actions receives the
    // parameters as separate arguments. If an object is passed, then the
    // actions receives one parameter object where under the same keys the
    // specified parameter values are stored.
    let asObject = false
    if (isArray(parameters)) {
      for (const { name, ...schema } of parameters) {
        addParameter(name, schema)
      }
    } else if (isObject(parameters)) {
      asObject = true
      for (const [name, schema] of Object.entries(parameters)) {
        if (schema) {
          addParameter(name, schema)
        }
      }
    } else if (parameters) {
      throw new Error(`Invalid parameters definition: ${parameters}`)
    }
    const schema = properties
      ? convertSchema({ type: 'object', properties }, options)
      : null
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
      asObject,
      dataName,
      validate: validate
        // Use `call()` to pass ctx as context to Ajv, see passContext:
        ? data => validate.call(ctx, data)
        : null
    }
  }

  createValidationError({ type, message, errors, options, json }) {
    return new ValidationError({
      type,
      message,
      errors: this.validator.parseErrors(errors, options),
      // Only include the JSON data in the error if `log.errors.json`is set.
      json: this.config.log.errors?.json ? json : undefined
    })
  }

  createDatabaseError(error) {
    // Remove knex SQL query and move to separate `sql` property.
    // TODO: Fix this properly in Knex / Objection instead, see:
    // https://gitter.im/Vincit/objection.js?at=5a68728f5a9ebe4f75ca40b0
    const [, sql, message] = error.message.match(/^([\s\S]*) - ([\s\S]*?)$/) ||
      [null, null, error.message]
    return new DatabaseError(error, {
      message,
      // Only include the SQL query in the error if `log.errors.sql`is set.
      sql: this.config.log.errors?.sql ? sql : undefined
    })
  }

  setupMiddleware(middleware) {
    const { app, log } = this.config

    // Setup global middleware

    this.use(attachLogger(this.logger))
    if (app.responseTime !== false) {
      this.use(responseTime(getOptions(app.responseTime)))
    }
    if (log.requests) {
      this.use(logRequests())
    }
    // This needs to be positioned after the request logger to log the correct
    // response status.
    this.use(handleError())
    if (app.helmet !== false) {
      this.use(helmet(getOptions(app.helmet)))
    }
    if (app.cors !== false) {
      this.use(cors(getOptions(app.cors)))
    }
    if (app.compress !== false) {
      this.use(compress(merge(
        {
          // Use a reasonable default for Brotli compression.
          // See https://github.com/koajs/compress/issues/126
          br: {
            params: {
              [zlib.constants.BROTLI_PARAM_QUALITY]: 4
            }
          }
        },
        getOptions(app.compress)
      )))
    }
    if (app.etag !== false) {
      this.use(conditional())
      this.use(etag())
    }

    // Controller-specific middleware

    // 1. Find route from routes installed by controllers.
    this.use(findRoute(this.router))
    // 2. Additional, user-space application-level middleware.
    if (middleware) {
      this.use(middleware)
    }
    // 3. body parser
    this.use(bodyParser(getOptions(app.bodyParser)))
    // 4. respect transacted settings, create and handle transactions.
    this.use(createTransaction())
    // 5. session
    if (app.session) {
      const {
        modelClass,
        ...options
      } = getOptions(app.session)
      if (modelClass) {
        // Create a ContextStore that resolved the specified model class,
        // uses it to persist and retrieve the session, and automatically
        // binds all db operations to `ctx.transaction`, if it is set.
        // eslint-disable-next-line new-cap
        options.ContextStore = SessionStore(modelClass)
      }
      this.use(session(options, this))
    }
    // 6. passport
    if (app.passport) {
      this.use(passport.initialize())
      if (app.session) {
        this.use(passport.session())
      }
      this.use(handleUser())
    }
    // 6. finally handle the found route, or set status / allow accordingly.
    this.use(handleRoute())
  }

  setupLogger() {
    const { err, req, res } = pino.stdSerializers
    // Only include `id` from the user, to not inadvertently log PII.
    const user = user => ({ id: user.id })
    const serializers = { err, req, res, user }

    const { prettyPrint, ...options } = merge({
      level: 'info',
      serializers,
      prettyPrint: {
        colorize: true,
        // List of keys to ignore in pretty mode.
        ignore: 'req,res,durationMs,user,requestId',
        // SYS to use system time and not UTC.
        translateTime: 'SYS:HH:MM:ss.l'
      },
      // Redact common sensitive headers.
      redact: [
        '*.headers["cookie"]',
        '*.headers["set-cookie"]',
        '*.headers["authorization"]'
      ],
      base: null // no pid,hostname,name
    }, getOptions(this.config.logger))

    const transport = prettyPrint
      ? pino.transport({
        target: 'pino-pretty',
        options: prettyPrint
      }) : null

    const logger = pino(options, transport)

    this.logger = logger.child({ name: 'app' })
  }

  setupKnex() {
    let { knex, log } = this.config
    if (knex?.client) {
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
      // Support PostgreSQL type parser mappings in the config.
      if (
        knex.client === 'postgresql' &&
        knex.typeParsers &&
        this.knex.client.driver
      ) {
        for (const [type, parser] of Object.entries(knex.typeParsers)) {
          this.knex.client.driver.types.setTypeParser(type, parser)
        }
      }
      if (log.sql) {
        this.setupKnexLogging()
      }
    }
  }

  setupKnexLogging() {
    const startTimes = {}
    const logger = this.logger.child({ name: 'sql' })
    function end(query, { response, error }) {
      const id = query.__knexQueryUid
      const diff = process.hrtime(startTimes[id])
      const duration = diff[0] * 1e3 + diff[1] / 1e6
      delete startTimes[id]
      const { sql, bindings } = query
      response = Object.fromEntries(
        Object.entries(response).filter(
          ([key]) => !key.startsWith('_')
        )
      )
      logger.info({ duration, bindings, response, error }, sql)
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

  normalizePath(path) {
    return this.config.app.normalizePaths ? hyphenate(path) : path
  }

  formatError(err) {
    const message = err.toJSON
      ? formatJson(err.toJSON())
      : err.message || err
    const str = `${err.name}: ${message}`
    return err.stack && this.config.log.errors?.stack !== false
      ? `${str}\n${err.stack.split(/\n|\r\n|\r/).slice(1).join(os.EOL)}`
      : str
  }

  logError(err, ctx) {
    if (!err.expose && !this.silent) {
      try {
        const text = this.formatError(err)
        const level =
          err instanceof ResponseError && err.status < 500 ? 'info' : 'error'
        const logger = ctx?.logger || this.logger
        logger[level](text)
      } catch (e) {
        console.error('Could not log error', e)
      }
    }
  }

  async start() {
    if (this.config.log.errors !== false) {
      this.on('error', this.logError)
    }
    await this.emit('before:start')
    this.server = await new Promise(resolve => {
      const server = this.listen(this.config.server, () => {
        const { address, port } = server.address()
        console.info(
          `Dito.js server started at http://${address}:${port}`
        )
        resolve(server)
      })
    })
    if (!this.server) {
      throw new Error('Unable to start Dito.js server')
    }
    this.isRunning = true
    await this.emit('after:start')
  }

  async stop(timeout = 0) {
    if (!this.server) {
      throw new Error('Dito.js server is not running')
    }

    const promise = (async () => {
      await this.emit('before:stop')
      this.isRunning = false
      await new Promise((resolve, reject) => {
        this.server.close(toPromiseCallback(resolve, reject))
      })
      // Hack to make sure that the server is closed, even if sockets are still
      // open after `server.close()`, see: https://stackoverflow.com/a/36830072
      this.server.emit('close')
      this.server = null
      await this.emit('after:stop')
    })()

    if (timeout > 0) {
      await Promise.race([
        promise,
        new Promise((resolve, reject) =>
          setTimeout(reject,
            timeout,
            new Error(
              `Timeout reached while stopping Dito.js server (${timeout}ms)`
            )
          )
        )
      ])
    } else {
      await promise
    }

    if (this.config.log.errors !== false) {
      this.off('error', this.logError)
    }
  }

  async startOrExit() {
    try {
      await this.start()
    } catch (err) {
      this.logError(err)
      process.exit(-1)
    }
  }

  // Assets handling

  async createAssets(storage, files, count = 0, trx = null) {
    const AssetModel = this.getModel('Asset')
    if (AssetModel) {
      const assets = files.map(file => ({
        key: file.key,
        file,
        storage: storage.name,
        count
      }))
      return AssetModel
        .query(trx)
        .insert(assets)
    }
    return null
  }

  async handleAdddedAndRemovedAssets(
    storage,
    addedFiles,
    removedFiles,
    trx = null
  ) {
    const {
      assets: {
        cleanupTimeThreshold = 0
      } = {}
    } = this.config
    // Only remove unused assets that haven't seen changes for given timeframe.
    const timeThreshold = isString(cleanupTimeThreshold)
      ? parseDuration(cleanupTimeThreshold)
      : cleanupTimeThreshold

    const importedFiles = []
    const AssetModel = this.getModel('Asset')
    if (AssetModel) {
      importedFiles.push(
        ...await this.addForeignAssets(storage, addedFiles, trx)
      )
      if (
        addedFiles.length > 0 ||
        removedFiles.length > 0
      ) {
        const changeCount = (files, increment) => (
          files.length > 0 &&
          AssetModel.query(trx)
            .whereIn('key', files.map(file => file.key))
            .increment('count', increment)
        )
        await Promise.all([
          changeCount(addedFiles, 1),
          changeCount(removedFiles, -1)
        ])
        if (timeThreshold > 0) {
          setTimeout(
            // Don't pass `trx` here, as we want this delayed execution to
            // create its own transaction.
            () => this.releaseUnusedAssets(timeThreshold),
            timeThreshold
          )
        }
      }
      // Also execute releaseUnusedAssets() immediately in the same
      // transaction, to potentially clean up other pending assets.
      await this.releaseUnusedAssets(timeThreshold, trx)
      return importedFiles
    }
  }

  async addForeignAssets(storage, files, trx = null) {
    const importedFiles = []
    const AssetModel = this.getModel('Asset')
    if (AssetModel) {
      // Find missing assets (copied from another system), and add them.
      await Promise.all(
        files.map(async file => {
          const asset = await AssetModel.query(trx).findOne('key', file.key)
          if (!asset) {
            if (file.data || file.url) {
              let { data } = file
              if (!data) {
                const { url } = file
                if (!storage.isImportSourceAllowed(url)) {
                  throw new AssetError(
                    `Unable to import asset from foreign source: '${
                      file.name
                    }' ('${
                      url
                    }'): The source needs to be explicitly allowed.`
                  )
                }
                console.info(
                  `${
                    pico.red('INFO:')
                  } Asset ${
                    pico.green(`'${file.name}'`)
                  } is from a foreign source, fetching from ${
                    pico.green(`'${url}'`)
                  } and adding to storage ${
                    pico.green(`'${storage.name}'`)
                  }...`
                )
                if (url.startsWith('file://')) {
                  const filepath = path.resolve(url.substring(7))
                  data = await fs.readFile(filepath)
                } else {
                  const response = await axios.request({
                    method: 'get',
                    responseType: 'arraybuffer',
                    url
                  })
                  data = response.data
                }
              }
              const importedFile = await storage.addFile(file, data)
              await this.createAssets(storage, [importedFile], 0, trx)
              // Merge back the changed file properties into the actual files
              // object, so that the data from the static model hook can be used
              // directly for the actual running query.
              Object.assign(file, importedFile)
              importedFiles.push(importedFile)
            } else {
              throw new AssetError(
                `Unable to import asset from foreign source: '${
                  file.name
                }' ('${
                  file.key
                }')`
              )
            }
          } else {
            // Asset is from a foreign source, but was already imported and can
            // be reused. See above for an explanation of this merge.
            Object.assign(file, asset.file)
            // NOTE: No need to add `file` to `importedFiles`, since it's
            // already been imported to the storage before.
          }
        })
      )
    }
    return importedFiles
  }

  async handleModifiedAssets(storage, files, trx = null) {
    const modifiedFiles = []
    const AssetModel = this.getModel('Asset')
    if (AssetModel) {
      await Promise.all(
        files.map(async file => {
          if (file.data) {
            const asset = await AssetModel.query(trx).findOne('key', file.key)
            if (asset) {
              const changedFile = await storage.addFile(file, file.data)
              // Merge back the changed file properties into the actual files
              // object, so that the data from the static model hook can be used
              // directly for the actual running query.
              Object.assign(file, changedFile)
              modifiedFiles.push(changedFile)
            } else {
              throw new AssetError(
                `Unable to update modified asset from memory source: '${
                  file.name
                }' ('${
                  file.key
                }')`
              )
            }
          }
        })
      )
    }
    return modifiedFiles
  }

  async releaseUnusedAssets(timeThreshold = 0, trx = null) {
    const AssetModel = this.getModel('Asset')
    if (AssetModel) {
      return AssetModel.transaction(trx, async trx => {
        // Determine the time threshold in JS instead of SQL, as there is no
        // easy cross-SQL way to do `now() - interval X hours`:
        const date = new Date()
        date.setMilliseconds(date.getMilliseconds() - timeThreshold)
        const orphanedAssets = await AssetModel
          .query(trx)
          .where('count', 0)
          .andWhere('updatedAt', '<=', date)
          // Protect freshly created assets from being deleted again right away,
          // .e.g. when `config.assets.cleanupTimeThreshold = 0`
          .andWhere('updatedAt', '>', ref('createdAt'))
        if (orphanedAssets.length > 0) {
          const orphanedKeys = await Promise.all(
            orphanedAssets.map(async asset => {
              try {
                await this.getStorage(asset.storage).removeFile(asset.file)
              } catch (error) {
                this.emit('error', error)
                asset.error = error
              }
              return asset.key
            })
          )
          await AssetModel
            .query(trx)
            .delete()
            .whereIn('key', orphanedKeys)
        }
        return orphanedAssets
      })
    }
  }
}

// Override Koa's events with our own EventEmitter that adds support for
// asynchronous events.
EventEmitter.mixin(Application.prototype)

function getOptions(options) {
  return isObject(options) ? options : {}
}
