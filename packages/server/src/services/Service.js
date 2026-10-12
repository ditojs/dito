import { camelize, hyphenate } from '@ditojs/utils'

export class Service {
  initialized = false
  #loggerName

  constructor(app, name) {
    this.app = app
    this.name = camelize(
      (name || this.constructor.name).match(/^(.*?)(?:Service|)$/)[1]
    )
    this.#loggerName = hyphenate(this.name)
    this.config = null
  }

  // @overridable
  configure(config) {
    this.config = config
  }

  // @overridable
  async initialize() {}

  // @overridable
  async start() {}

  // @overridable
  async stop() {}

  get logger() {
    return this.app.logger.child({ name: this.#loggerName })
  }
}
