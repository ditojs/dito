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

  setup(config) {
    this.config = config
    this.app.on('before:start', () => this.start())
    this.app.on('after:stop', () => this.stop())
  }

  // @overridable
  async initialize() {}

  // @overridable
  async start() {}

  // @overridable
  async stop() {}

  /** @deprecated Use `instance.logger` instead. */
  getLogger() {
    return this.logger
  }

  get logger() {
    const logger = this.app.requestLocals.logger ?? this.app.logger
    return logger.child({ name: this.#loggerName })
  }
}
