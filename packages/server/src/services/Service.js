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
}
