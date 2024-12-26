import path from 'path'
import util from 'util'
import zlib from 'zlib'
import fs from 'fs/promises'
import Koa from 'koa'
import Knex from 'knex'
import pico from 'picocolors'
import pino from 'pino'
import bodyParser from 'koa-bodyparser'
import cors from '@koa/cors'
import compose from 'koa-compose'
import compress from 'koa-compress'
import conditional from 'koa-conditional-get'
import mount from 'koa-mount'
import passport from 'koa-passport'
import etag from 'koa-etag'
import helmet from 'koa-helmet'
import responseTime from 'koa-response-time'
import { Model, knexSnakeCaseMappers, ref } from 'objection'
import Router from '@ditojs/router'
import {
  isArray,
  isObject,
  asArray,
  isPlainObject,
  isModule,
  hyphenate,
  clone,
  groupBy,
  assignDeeply,
  parseDataPath,
  normalizeDataPath,
  toPromiseCallback,
  mapConcurrently,
  deprecate
} from '@ditojs/utils'
import { Validator } from './Validator.js'
import { EventEmitter } from '../lib/index.js'
import { Controller, AdminController } from '../controllers/index.js'
import { Service } from '../services/index.js'
import { Storage } from '../storage/index.js'
import { convertSchema } from '../schema/index.js'
import { getDuration, subtractDuration } from '../utils/duration.js'
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
  extendContext,
  handleError,
  handleRoute,
  handleSession,
  handleUser,
  logRequests,
  setupRequestStorage
} from '../middleware/index.js'
import { AsyncLocalStorage } from 'async_hooks'

export class Application extends Koa {
  #logger

  constructor({
    config = {},
    validator,
    router,
    events,
    middleware,
    services,
    models,
    controllers
  } = {}) {
    super()
    this._configureEmitter(events)
    const {
      // Pluck keys out of `config.app` to keep them secret
      app: { keys, ...app } = {},
      log,
      assets,
      logger,
      ...rest
    } = config
    this.config = {
      app,
      log:
        log === false || log?.silent || process.env.DITO_SILENT
          ? {}
          : getOptions(log),
      assets: assignDeeply(defaultAssetOptions, getOptions(assets)),
      logger: assignDeeply(defaultLoggerOptions, getOptions(logger)),
      ...rest
    }
    this.keys = keys
    this.proxy = !!app.proxy
    this.validator = validator || new Validator()
    this.router = router || new Router()
    this.validator.app = this
    this.storages = Object.create(null)
    this.services = Object.create(null)
    this.models = Object.create(null)
    this.controllers = Object.create(null)
    this.server = null
    this.isRunning = false
    this.requestStorage = new AsyncLocalStorage()

    // TODO: Rename setup to configure?
    this.setupLogger()
    this.setupKnex()
    this.setupMiddleware(middleware)

    if (config.storages) {
      this.addStorages(config.storages)
    }
    if (services) {
      this.addServices(services)
    }
    if (models) {
      this.addModels(models)
    }
    if (controllers) {
      this.addControllers(controllers)
    }
  }

  async setup() {
    await this.setupStorages()
    await this.setupServices()
    await this.setupModels()
    await this.setupControllers()
  }

  addRoute(
    method,
    path,
    transacted,
    middlewares,
    controller = null,
    action = null
  ) {
    middlewares = asArray(middlewares)
    const middleware =
      middlewares.length > 1
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

  fixModuleClassNames(modules) {
    // Naming fix for a weird vite 6 bug where the model classes are sometimes
    // prefixed with `_`, sometimes suffixed with numbers, but only when
    // imported through `vite.config.js`.
    // NOTE: This only happens when `Application` is imported into
    // `admin.vite.config.js` in order to call `app.defineAdminViteConfig()`
    if (isPlainObject(modules)) {
      for (const [key, module] of Object.entries(modules)) {
        if (
          module &&
          module.name !== key &&
          module.name?.replace(/^_|\d+$/g, '') === key
        ) {
          Object.defineProperty(module, 'name', {
            value: key,
            writable: false,
            enumerable: false,
            configurable: true
          })
        }
      }
    }
  }

  getStorage(name) {
    return this.storages[name] || null
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

  addStorages(storages) {
    this.fixModuleClassNames(storages)
    for (const [key, config] of Object.entries(storages)) {
      this.addStorage(config, key)
    }
  }

  async setupStorages() {
    await Promise.all(
      Object.values(this.storages)
        .filter(storage => !storage.initialized)
        .map(async storage => {
          // Different from models, services and controllers, storages can have
          // async `setup()` methods, as used by `S3Storage`.
          await storage.setup()
          await storage.initialize()
          storage.initialized = true
        })
    )
  }

  getService(name) {
    return this.services[name] || null
  }

  findService(callback) {
    return Object.values(this.services).find(callback) || null
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
    this.services[service.name] = service
  }

  addServices(services) {
    this.fixModuleClassNames(services)
    for (const [key, service] of Object.entries(services)) {
      this.addService(service, key)
    }
  }

  async setupServices() {
    await Promise.all(
      Object.values(this.services)
        .filter(service => !service.initialized)
        .map(async service => {
          const { name } = service
          const config = this.config.services[name]
          if (config === undefined) {
            throw new Error(`Configuration missing for service '${name}'`)
          }
          // As a convention, the configuration of a service can be set to
          // `false` in order to entirely deactivate the service.
          if (config === false) {
            delete this.services[name]
          } else {
            service.setup(config)
            await service.initialize()
            service.initialized = true
          }
        })
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
    return Object.values(this.models).find(callback) || null
  }

  addModel(modelClass) {
    this.addModels([modelClass])
  }

  addModels(models) {
    this.fixModuleClassNames(models)
    models = Object.values(models)
    // First, add all models to the application, so that they can be referenced
    // by other models, e.g. in `jsonSchema` and  `relationMappings`:
    for (const modelClass of models) {
      if (Model.isPrototypeOf(modelClass)) {
        this.models[modelClass.name] = modelClass
      } else {
        throw new Error(`Invalid model class: ${modelClass}`)
      }
    }
    // Then, configure all models and add their schemas to the validator:
    for (const modelClass of models) {
      modelClass.configure(this)
      this.validator.addSchema(modelClass.getJsonSchema())
    }
    this.logModels(models)
  }

  async setupModels() {
    await Promise.all(
      Object.values(this.models)
        .filter(modelClass => !modelClass.initialized)
        .map(async modelClass => {
          // While `setup()` is used for internal dito things, `initialize()` is
          // called async and meant to be used by the user, without the need to
          // call `super.initialize()`.
          modelClass.setup()
          await modelClass.initialize()
          modelClass.initialized = true
        })
    )
  }

  logModels(models) {
    const { log } = this.config
    if (log.schema || log.relations) {
      for (const modelClass of models) {
        const shouldLog = option => (
          option === true || asArray(option).includes(modelClass.name)
        )
        const data = {}
        if (shouldLog(log.schema)) {
          data.schema = modelClass.getJsonSchema()
        }
        if (shouldLog(log.relations)) {
          data.relations = clone(modelClass.getRelationMappings(), {
            processValue: value =>
              Model.isPrototypeOf(value)
                ? `[Model: ${value.name}]`
                : value
          })
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

  getController(url) {
    return this.controllers[url] || null
  }

  findController(callback) {
    return Object.values(this.controllers).find(callback) || null
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
    // so call separate `configure()` method after in order to take care of it.
    controller.configure()
    this.controllers[controller.url] = controller
  }

  addControllers(controllers, namespace) {
    this.fixModuleClassNames(controllers)
    for (const [key, value] of Object.entries(controllers)) {
      if (isModule(value) || isPlainObject(value)) {
        this.addControllers(value, namespace ? `${namespace}/${key}` : key)
      } else {
        this.addController(value, namespace)
      }
    }
  }

  async setupControllers() {
    await Promise.all(
      Object.values(this.controllers)
        .filter(controller => !controller.initialized)
        .map(async controller => {
          controller.setup()
          await controller.initialize()
          // Each controller can also compose their own middleware (or app),
          // e.g.  as used in `AdminController`:
          const composed = controller.compose()
          if (composed) {
            this.use(mount(controller.url, composed))
          }
          controller.initialized = true
        })
    )
  }

  getAdminController() {
    return this.findController(
      controller => controller instanceof AdminController
    )
  }

  defineAdminViteConfig(config) {
    return this.getAdminController()?.defineViteConfig(config) || null
  }

  async loadAdminViteConfig() {
    const cwd = process.cwd()
    for (const extension of ['js', 'mjs', 'cjs', 'ts']) {
      const file = path.join(cwd, `admin.vite.config.${extension}`)
      try {
        await fs.access(file)
        return (await import(file)).default
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error
        }
      }
    }
    return null
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
            relation,
            wildcard,
            nestedDataPath,
            name
          } = modelClass.getPropertyOrRelationAtDataPath(assetDataPath)
          if (relation) {
            throw new Error('Assets on nested relations are not supported')
          } else if (property || wildcard) {
            const normalizedName = normalizeDbNames
              ? this.normalizeIdentifier(name)
              : name
            const dataPath = normalizeDataPath([
              wildcard || normalizedName,
              ...parseDataPath(nestedDataPath)
            ])
            const assetConfigs = (convertedAssets[normalizedName] ||= {})
            assetConfigs[dataPath] = config
          }
        }
        assetConfig[normalizedModelName] = convertedAssets
      }
    }
    return assetConfig
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
        ? // Use `call()` to pass ctx as context to Ajv, see passContext:
          data => validate.call(ctx, data)
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
    const [, sql, message] = (
      error.message.match(/^([\s\S]*) - ([\s\S]*?)$/) ||
      [null, null, error.message]
    )
    return new DatabaseError(error, {
      message,
      // Only include the SQL query in the error if `log.errors.sql`is set.
      sql: this.config.log.errors?.sql ? sql : undefined
    })
  }

  setupMiddleware(middleware) {
    const { app, log } = this.config

    // Setup global middleware

    this.use(attachLogger(this.#logger))
    if (app.responseTime !== false) {
      this.use(responseTime(getOptions(app.responseTime)))
    }
    if (log.requests) {
      this.use(
        logRequests({
          ignoreUrlPattern: /(\.js$|\.scss$|\.vue$|\/@vite\/|\/@fs\/|\/@id\/)/
        })
      )
    }
    // This needs to be positioned after the request logger to log the correct
    // response status.
    this.use(handleError())
    this.use(extendContext())
    if (app.helmet !== false) {
      this.use(helmet(getOptions(app.helmet)))
    }
    if (app.cors !== false) {
      this.use(cors(getOptions(app.cors)))
    }
    if (app.compress !== false) {
      this.use(
        compress(
          assignDeeply(
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
          )
        )
      )
    }
    if (app.etag !== false) {
      this.use(conditional())
      this.use(etag())
    }
    this.use(setupRequestStorage(this.requestStorage))

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
      this.use(handleSession(this, getOptions(app.session)))
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
    const { prettyPrint, ...options } = this.config.logger
    const transport = prettyPrint
      ? pino.transport({
          target: 'pino-pretty',
          options: prettyPrint
        })
      : null
    this.#logger = pino(options, transport).child({ name: 'app' })
  }

  setupKnex() {
    let { knex, log } = this.config
    if (knex?.client) {
      const snakeCaseOptions =
        knex.normalizeDbNames === true
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
        const { types } = this.knex.client.driver
        // Support type parser mappings defined in user-land.
        for (const [type, parser] of Object.entries(knex.typeParsers)) {
          types.setTypeParser(type, parser)
        }
        // Automatically setup array type parsers for numeric and int8.
        const setupArrayParser = (valueType, arrayType) => {
          if (
            valueType in knex.typeParsers &&
            !(arrayType in knex.typeParsers)
          ) {
            const parseValue = types.getTypeParser(valueType)
            const parseArray = types.getTypeParser(arrayType)
            types.setTypeParser(arrayType, text =>
              parseArray(text).map(value =>
                value === null ? value : parseValue(value)
              )
            )
          }
        }

        setupArrayParser(1700, 1231) // numeric
        setupArrayParser(20, 1016) // int8
        // setupArrayParser(21, 1005) // int2
        // setupArrayParser(23, 1007) // int4
        // setupArrayParser(700, 1021) // float4
        // setupArrayParser(701, 1022) // float8
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
      response = response
        ? Object.fromEntries(
            Object.entries(response).filter(
              ([key]) => !key.startsWith('_')
            )
          )
        : null
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

  formatError(error) {
    // Shallow-clone the error to be able to delete hidden properties.
    const copy = clone(error, { shallow: true, enumerable: false })
    // Remove headers added by the CORS middleware.
    delete copy.headers
    if (this.config.log.errors?.stack === false) {
      delete copy.stack
      delete copy.cause
    }
    // Use `util.inspect()` instead of Pino's internal error logging for better
    // stack traces and logging of error data.
    return this.config.logger.prettyPrint
      ? util.inspect(copy, {
          colors: !!this.config.logger.prettyPrint.colorize,
          compact: false,
          depth: null,
          maxArrayLength: null
        })
      : copy
  }

  logError(error, ctx) {
    if (!error.expose && !this.silent) {
      try {
        const logger = ctx?.logger || this.logger
        const level =
          error instanceof ResponseError && error.status < 500
            ? 'info'
            : 'error'
        logger[level](this.formatError(error))
      } catch (e) {
        console.error('Could not log error', e)
      }
    }
  }

  async start() {
    if (this.config.log.errors !== false) {
      this.on('error', this.logError)
    }
    // It's ok to call this multiple times, because only the entries in the
    // registers (storages, services, models, controllers) that weren't
    // initialized yet will be initialized.
    await this.setup()
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
          setTimeout(
            reject,
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

  async execute() {
    try {
      await this.start()
    } catch (err) {
      this.logError(err)
      process.exit(-1)
    }
  }

  startOrExit() {
    deprecate(`app.startOrExit() is deprecated. Use app.execute() instead.`)
    return this.execute()
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
      return AssetModel.query(trx).insert(assets)
    }
    return null
  }

  async handleAddedAndRemovedAssets(
    storage,
    addedFiles,
    removedFiles,
    changedFiles,
    trx = null
  ) {
    let importedFiles = []
    const AssetModel = this.getModel('Asset')
    if (AssetModel) {
      importedFiles = await this.addForeignAssets(
        storage,
        [...addedFiles, ...changedFiles],
        trx
      )
      if (
        addedFiles.length > 0 ||
        removedFiles.length > 0
      ) {
        const changeCount = async (files, increment) => {
          if (files.length > 0) {
            await AssetModel.query(trx)
              .whereIn(
                'key',
                files.map(file => file.key)
              )
              .increment('count', increment)
          }
        }
        await Promise.all([
          changeCount(addedFiles, 1),
          changeCount(removedFiles, -1)
        ])
        const cleanupTimeThreshold = getDuration(
          this.config.assets.cleanupTimeThreshold
        )
        if (cleanupTimeThreshold > 0) {
          setTimeout(
            // Don't pass `trx` here, as we want this delayed execution to
            // create its own transaction.
            () => this.releaseUnusedAssets(),
            cleanupTimeThreshold
          )
        }
      }
      // Also execute releaseUnusedAssets() immediately in the same
      // transaction, to potentially clean up other pending assets.
      await this.releaseUnusedAssets(null, trx)
      return importedFiles
    }
  }

  async addForeignAssets(storage, files, trx = null) {
    const importedFiles = []
    const AssetModel = this.getModel('Asset')
    if (AssetModel) {
      // Find missing assets (copied from another system), and add them.
      const filesByKey = groupBy(files, file => file.key)
      await mapConcurrently(
        Object.entries(filesByKey),
        async ([key, files]) => {
          const asset = await AssetModel.query(trx).findOne('key', key)
          if (!asset) {
            const [file] = files // Pick the first file
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
                this.logger.info(
                  `Asset ${
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
                  const response = await fetch(url)
                  const arrayBuffer = await response.arrayBuffer()
                  // `fs.writeFile()` expects a Buffer, not an ArrayBuffer.
                  data = Buffer.from(arrayBuffer)
                }
              }
              const importedFile = await storage.addFile(file, data)
              await this.createAssets(storage, [importedFile], 0, trx)
              importedFiles.push(importedFile)
              // Merge back the changed file properties into the actual file
              // objects, so that the data from the static model hook can be
              // used directly for the actual running query.
              for (const file of files) {
                Object.assign(file, importedFile)
              }
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
            for (const file of files) {
              Object.assign(file, asset.file)
            }
            // NOTE: No need to add `file` to `importedFiles`, since it's
            // already been imported to the storage before.
          }
        },
        { concurrency: storage.concurrency }
      )
    }
    return importedFiles
  }

  async handleModifiedAssets(storage, files, trx = null) {
    const modifiedFiles = []
    const AssetModel = this.getModel('Asset')
    if (AssetModel) {
      await mapConcurrently(files, async file => {
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
    }
    return modifiedFiles
  }

  async releaseUnusedAssets(timeThreshold = null, trx = null) {
    const AssetModel = this.getModel('Asset')
    if (AssetModel) {
      const { assets } = this.config
      const cleanupTimeThreshold = getDuration(
        timeThreshold ?? assets.cleanupTimeThreshold
      )
      const danglingTimeThreshold = getDuration(
        timeThreshold ?? assets.danglingTimeThreshold
      )
      return AssetModel.transaction(trx, async trx => {
        // Calculate the date math in JS instead of SQL, as there is no easy
        // cross-SQL way to do `now() - interval X hours`:
        const now = new Date()
        const cleanupDate = subtractDuration(now, cleanupTimeThreshold)
        const danglingDate = subtractDuration(now, danglingTimeThreshold)
        const orphanedAssets = await AssetModel.query(trx)
          .where('count', 0)
          .andWhere(query =>
            query
              .where('updatedAt', '<=', cleanupDate)
              .orWhere(
                // Protect freshly created assets from being deleted again
                // right away, when `config.assets.cleanupTimeThreshold = 0`
                query =>
                  query
                    .where('updatedAt', '=', ref('createdAt'))
                    .andWhere('updatedAt', '<=', danglingDate)
              )
          )
        if (orphanedAssets.length > 0) {
          const orphanedKeys = await mapConcurrently(
            orphanedAssets,
            async asset => {
              try {
                await this.getStorage(asset.storage).removeFile(asset.file)
              } catch (error) {
                this.emit('error', error)
                asset.error = error
              }
              return asset.key
            }
          )
          await AssetModel.query(trx).delete().whereIn('key', orphanedKeys)
        }
        return orphanedAssets
      })
    }
  }

  get requestLocals() {
    return this.requestStorage.getStore() ?? {}
  }

  get logger() {
    return this.requestLocals.logger ?? this.#logger
  }
}

// Override Koa's events with our own EventEmitter that adds support for
// asynchronous events.
EventEmitter.mixin(Application.prototype)

function getOptions(options) {
  return isObject(options) ? options : {}
}

const defaultAssetOptions = {
  // Only remove unused or dangling assets that haven't seen changes for
  // these given time frames. Set to `0` to clean up instantly.
  cleanupTimeThreshold: '24h',
  // Dangling assets are those that got uploaded but never actually persisted in
  // the model. This can happen when the admin uploads a file but doesn't store
  // the associated form. This cannot be set to 0 or else the the file would be
  // deleted immediately after upload.
  danglingTimeThreshold: '24h'
}

const { err, req, res } = pino.stdSerializers
const defaultLoggerOptions = {
  level: 'info',
  serializers: {
    err,
    req,
    res,
    // Only include `id` from the user, to not inadvertently log PII.
    user: user => ({ id: user.id })
  },
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
}
