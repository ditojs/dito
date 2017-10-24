import Knex from 'knex'
import Koa from 'koa'
import { underscore } from '@/utils'
import Validator from '@/model/Validator'
import KnexMixin from './KnexMixin'

export default class App extends Koa {
  constructor(config, { validator, models }) {
    super()
    this.config = config
    this.normalizeDbNames = config.normalizeDbNames
    let knexConfig = config.knex
    if (this.normalizeDbNames) {
      // Always convert Knex identifiers to underscored versions.
      // TODO: wrapIdentifier will only work in Knex 0.14.0 onwards.
      // Until then, use the _wrapString() hack below instead.
      knexConfig = {
        ...knexConfig,
        wrapIdentifier(value, wrapIdentifier) {
          return wrapIdentifier(underscore(value))
        }
      }
    }
    this.knex = KnexMixin(Knex(knexConfig))
    if (this.normalizeDbNames) {
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

  start() {
    const {
      server: { host, port },
      environment
    } = this.config
    return new Promise(resolve => {
      this.server = this.listen(port, host, () => {
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
  }

  stop() {
    return new Promise((resolve, reject) => {
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
  }
}
