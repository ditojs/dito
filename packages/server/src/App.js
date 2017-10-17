import Knex from 'knex'
import Koa from 'koa'
import Validator from './model/Validator'
import EventEmitterMixin from './model/EventEmitterMixin'

export default class App extends Koa {
  constructor(config, { validator, models }) {
    super()
    this.config = config
    this.normalizeDbNames = config.normalizeDbNames
    this.knex = Knex(config.knex)
    this.models = {}
    this.validator = validator || new Validator()
    if (models) {
      this.addModels(models)
    }
  }

  addModels(models) {
    for (const modelClass of Object.values(models)) {
      this.addModel(modelClass)
    }
    this.checkSchemas()
  }

  addModel(modelClass) {
    EventEmitterMixin(modelClass)
    modelClass.app = this
    this.models[modelClass.name] = modelClass
    modelClass.knex(this.knex)
    modelClass.onAny((event, ctx) => {
      console.log(event, 'state:', ctx.state)
    })
  }

  checkSchemas() {
    for (const modelClass of Object.values(this.models)) {
      modelClass.checkSchema()
    }
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
