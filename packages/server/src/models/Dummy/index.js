import Model from '../../core/Model'
import properties from './properties'
import methods from './methods'
import routes from './routes'

export default class Dummy extends Model {
  get fullName() {
    return `${this.firstName} ${this.lastName}`
  }

  async hello(msg) {
    return `Hello ${this.fullName}: ${msg}`
  }

  static async somethingStatic() {
    // NOTE: This will be present as a static member method:
    // Dummy.someStaticMethod()
    await Promise.delay(1000)
    return 'One second has passed.'
  }

  static properties = properties
  static methods = methods
  static routes = routes
}
