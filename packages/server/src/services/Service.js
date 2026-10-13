import { camelize, hyphenate } from '@ditojs/utils'

export class Service {
  isInitialized = false
  #loggerName

  // The application passes no `config` and calls `configure()` once the
  // instance exists, as subclasses can override `name` in class fields:
  constructor(app, name, config = null) {
    this.app = app
    this.name = camelize(
      (name || this.constructor.name).match(/^(.*?)(?:Service|)$/)[1]
    )
    this.#loggerName = hyphenate(this.name)
    this.config = config
  }

  // Internal, called by the application. Apps override the hooks below, which
  // stay empty, so overrides never need to call super.
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
