import { camelize } from '@ditojs/utils'

export class Service {
  constructor(app, name) {
    this.app = app
    this.name = camelize(
      (name || this.constructor.name).match(/^(.*?)(?:Service|)$/)[1]
    )
    this.config = null
  }

  setup(config) {
    this.config = config
    this.app.on('before:start', () => this.start())
    this.app.on('after:stop', () => this.stop())
  }

  // @overridable
  initialize() {
  }

  // @overridable
  async start() {
  }

  // @overridable
  async stop() {
  }

  getLogger(ctx) {
    const logger = ctx?.logger ?? this.app.logger
    return logger.child({ name: this.name })
  }
}
