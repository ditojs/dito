import { camelize, hyphenate } from '@ditojs/utils'

export class Service {
  initialized = false
  #loggerName = null

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
  async initialize() {
  }

  // @overridable
  async start() {
  }

  // @overridable
  async stop() {
  }

  // Only use this method to get a logger instance that is bound to the context,
  // otherwise use the getter.
  getLogger(ctx) {
    const logger = ctx?.logger ?? this.app.logger
    return logger.child({ name: this.#loggerName })
  }

  get logger() {
    const value = this.getLogger()
    Object.defineProperty(this, 'logger', { value })
    return value
  }
}
