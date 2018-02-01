import Koa from 'koa'
import Knex from 'knex'
import chalk from 'chalk'
import bodyParser from 'koa-bodyparser'
import cors from '@koa/cors'
import compose from 'koa-compose'
import compress from 'koa-compress'
import conditional from 'koa-conditional-get'
import passport from 'koa-passport'
import session from 'koa-session'
import etag from 'koa-etag'
import helmet from 'koa-helmet'
import koaLogger from 'koa-logger'
import pinoLogger from 'koa-pino-logger'
import responseTime from 'koa-response-time'
import errorHandler from './errorHandler'
import { knexSnakeCaseMappers } from 'objection'
import { EventEmitter } from '@/lib'
import { ResponseError } from '@/errors'
import { Controller } from '@/controllers'
import { Validator } from './Validator'
import { hyphenate } from '@ditojs/utils'

export class Application extends Koa {
  constructor(config = {}, { validator, models, controllers }) {
    super()
    // Override Koa's events with our own EventEmitter that adds support for
    // asynchronous events.
    // TODO: Test if Koa's internal events still behave the same (they should!)
    EventEmitter.mixin(this)
    // Pluck keys out of config to keep them secret
    const { keys, ...conf } = config
    this.keys = keys
    this.config = conf
    this.proxy = conf.proxy
    this.models = Object.create(null)
    this.controllers = Object.create(null)
    this.validator = validator || new Validator()
    this.setupMiddleware()
    this.setupKnex()
    if (models) {
      this.addModels(models)
    }
    if (controllers) {
      this.addControllers(controllers)
    }
  }

  addModels(models) {
    // First add all models then call initialize() for each in a second loop,
    // since they may be referencing each other in relations.
    for (const modelClass of Object.values(models)) {
      this.addModel(modelClass)
    }
    for (const modelClass of Object.values(models)) {
      modelClass.initialize()
      this.validator.addSchema(modelClass.getJsonSchema())
    }
  }

  addModel(modelClass) {
    modelClass.app = this
    this.models[modelClass.name] = modelClass
    modelClass.knex(this.knex)
  }

  addControllers(controllers, namespace) {
    for (const [key, value] of Object.entries(controllers)) {
      if (value.prototype instanceof Controller) {
        this.addController(value, namespace)
      } else {
        this.addControllers(value, namespace ? `${namespace}/${key}` : key)
      }
    }
  }

  addController(ControllerClass, namespace) {
    const controller = new ControllerClass(this, namespace)
    // Inheritance of action methods cannot happen in the constructor itself,
    // so call a separate initialize() method after in order to take care of it.
    controller.initialize()
    this.controllers[controller.url] = controller
    this.use(controller.compose())
  }

  normalizePath(path) {
    return this.config.normalizePaths ? hyphenate(path) : path
  }

  compileValidator(jsonSchema) {
    return this.validator.compile(jsonSchema)
  }

  setupMiddleware() {
    const { config } = this

    const isTruthy = name => !!config[name]
    const isntFalse = name => config[name] !== false

    const { log = {} } = config
    const logger = {
      console: koaLogger,
      true: koaLogger,
      // TODO: Implement logging to actual file instead of console for Pino.
      file: pinoLogger
    }[log.server]

    this.use(
      compose([
        errorHandler(),
        isntFalse('responseTime') && responseTime(),
        logger?.(),
        isntFalse('helmet') && helmet(),
        isntFalse('cors') && cors(),
        isTruthy('compress') && compress(config.compress),
        ...(isTruthy('etag') && [
          conditional(),
          etag()
        ] || []),
        bodyParser(),
        isTruthy('session') && session(
          config.session === true ? {} : config.session,
          this
        ),
        ...(isTruthy('passport') && [
          passport.initialize(),
          passport.session()
        ] || [])
      ].filter(val => val))
    )
  }

  setupKnex() {
    const { config } = this
    let knexConfig = config.knex
    if (config.normalizeDbNames) {
      knexConfig = {
        ...knexConfig,
        ...knexSnakeCaseMappers()
      }
    }
    this.knex = Knex(knexConfig)
    if (config.log.sql) {
      this.setupKnexLogging()
    }
  }

  setupKnexLogging() {
    const startTimes = {}

    function trim(str, length = 200) {
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
      console.error(err instanceof ResponseError
        ? `${err.name}: ${JSON.stringify(err.toJSON(), null, '  ')}`
        : err.stack || err.toString()
      )
    }
  }

  async start() {
    if (!this.listeners('error').length) {
      this.on('error', this.onError)
    }
    await this.emit('before:start')
    const {
      server: { host, port },
      environment
    } = this.config
    await new Promise(resolve => {
      this.server = this.listen(port, host, () => {
        const { port } = this.server.address()
        console.log(
          `${environment} server started at http://${host}:${port}`
        )
        resolve(this.server)
      })
      if (!this.server) {
        resolve(new Error(`Unable to start server at http://${host}:${port}`))
      }
    })
    await this.emit('after:start')
  }

  async stop() {
    await this.emit('before:stop')
    await new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close(err => {
          this.server = null
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      } else {
        reject(new Error('Server is not running'))
      }
    })
    await this.emit('after:stop')
  }

  async startOrExit() {
    try {
      await this.start()
    } catch (err) {
      console.error(err)
      process.exit(-1)
    }
  }
}
