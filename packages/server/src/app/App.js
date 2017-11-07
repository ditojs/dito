import Koa from 'koa'
import Knex from 'knex'
import chalk from 'chalk'
import { Validator } from '@/model'
import { EventEmitter } from '@/mixins'
import { underscore, camelize } from '@/utils'

export default class App extends Koa {
  constructor(config = {}, { validator, models }) {
    super()
    // Override Koa's events with our own EventEmitter that adds support for
    // asynchronous events.
    // TODO: Test if Koa's internal events still behave the same (they should!)
    EventEmitter.mixin(this)
    if (config.normalizeDbNames) {
      // The `normalizeDbNames` option (plural) sets up the most common pair of
      // the `normalizeDbName` and `denormalizeDbName` options for us:
      config = {
        ...config,
        normalizeDbName: name => underscore(name),
        denormalizeDbName: name => camelize(name)
      }
    }
    this.config = config
    let knexConfig = config.knex
    const { normalizeDbName } = config
    if (normalizeDbName) {
      knexConfig = {
        ...knexConfig,
        // This is Knex' standard hook into processing identifiers.
        // We add the call to our own normalizeDbName() to it:
        // Note: wrapIdentifier only works in Knex ^0.14.0
        wrapIdentifier(value, wrapIdentifier) {
          return wrapIdentifier(normalizeDbName(value))
        }
      }
    }
    this.knex = Knex(knexConfig)
    if (config.log.sql) {
      this.setupKnexLogging()
    }
    this.models = {}
    this.validator = validator || new Validator()
    if (models) {
      this.addModels(models)
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
    }
  }

  addModel(modelClass) {
    modelClass.app = this
    this.models[modelClass.name] = modelClass
    modelClass.knex(this.knex)
  }

  normalizeDbName(name) {
    const { normalizeDbName } = this.config
    return normalizeDbName ? normalizeDbName(name) : name
  }

  denormalizeDbName(name) {
    const { denormalizeDbName } = this.config
    return denormalizeDbName ? denormalizeDbName(name) : name
  }

  setupKnexLogging() {
    const startTimes = {}

    function end(query, { response, error }) {
      const id = query.__knexQueryUid
      const duration = process.hrtime(startTimes[id])
      delete startTimes[id]
      console.log('  %s %s %s %s\n%s',
        chalk.yellow.bold('knex:sql'),
        chalk.cyan(query.sql),
        chalk.gray('{' + query.bindings.join(', ') + '}'),
        chalk.magenta(duration + 'ms'),
        response
          ? chalk.green(JSON.stringify(response))
          : error
            ? chalk.red(JSON.stringify(error))
            : ''
      )
    }

    this.knex.on('query', query => {
      startTimes[query.__knexQueryUid] = process.hrtime()
    })

    this.knex.on('query-response', (response, query) => {
      end(query, { response })
    })

    this.knex.on('query-error', (error, query) => {
      end(query, { error })
    })
  }

  async start() {
    const {
      server: { host, port },
      environment
    } = this.config
    await this.emit('before:start')
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
