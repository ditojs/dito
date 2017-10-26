import Knex from 'knex'
import Koa from 'koa'
import { underscore, camelize } from '@/utils'
import { mixinEventEmitter } from '@/events'
import Validator from '@/model/Validator'
import KnexMixin from './KnexMixin'

export default class App extends Koa {
  constructor(config, { validator, models }) {
    super()
    // Override Koa's events with our own EventEmitter that adds support for
    // asynchronous events.
    // TODO: Test if Koa's internal events still behave the same (they should!)
    mixinEventEmitter(this)
    this.config = config
    let { knex: knexConfig, normalizeDbNames } = config
    if (normalizeDbNames) {
      const normalizeIdentifier = name => underscore(name)
      const denormalizeIdentifier = name => camelize(name)

      // Always convert Knex identifiers to underscored versions.
      // TODO: wrapIdentifier will only work in Knex 0.14.0 onwards.
      // Until then, use the _wrapString() hack below instead.
      knexConfig = {
        ...knexConfig,

        // These are our own add-ons and used by our Model to convert
        // identifiers back and forth, see KnexMixin.js
        normalizeIdentifier,
        denormalizeIdentifier,

        // This is Knex' standard hook into processing identifiers.
        // We add the call to our own normalizeIdentifier() to it:
        wrapIdentifier(value, wrapIdentifier) {
          return wrapIdentifier(normalizeIdentifier(value))
        }
      }
    }
    this.knex = KnexMixin(Knex(knexConfig))
    if (normalizeDbNames) {
      // HACK: See above about replacing this with standardized wrapIdentifier()
      const { prototype } = this.knex.client.formatter().constructor
      const { _wrapString } = prototype
      if (_wrapString) {
        prototype._wrapString = function (value) {
          return knexConfig.wrapIdentifier(value, _wrapString.bind(this))
        }
      }
    }
    this.models = {}
    this.validator = validator || new Validator()
    if (models) {
      this.addModels(models)
    }
  }

  addModels(models) {
    // First add all models then call prepareModel() for each in a another loop,
    // since they may be referencing each other in relations.
    for (const modelClass of Object.values(models)) {
      this.addModel(modelClass)
    }
    for (const modelClass of Object.values(models)) {
      modelClass.prepareModel()
    }
  }

  addModel(modelClass) {
    modelClass.app = this
    this.models[modelClass.name] = modelClass
    modelClass.knex(this.knex)
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
        // TODO: logging?
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
