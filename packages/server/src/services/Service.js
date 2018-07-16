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

  initialize() {
    // Overridable in sub-classes
  }

  async start() {
    // Overridable in sub-classes
  }

  async stop() {
    // Overridable in sub-classes
  }
}
