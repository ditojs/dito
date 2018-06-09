import { camelize } from '@ditojs/utils'

export class Service {
  constructor(app, name) {
    this.app = app
    this.name = camelize(
      (name || this.constructor.name).match(/^(.*?)(?:Service|)$/)[1]
    )
    this.config = null
  }

  initialize(config = {}) {
    this.config = config
    // Now that config is set, call `setup()` which can be overridden by
    // implementing services.
    this.setup()
  }

  setup() {
  }

  async start() {
  }

  async stop() {
  }
}
