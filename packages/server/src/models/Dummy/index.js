import Model from '../../Model'
import properties from './properties'
import methods from './methods'
import routes from './routes'

export default class Dummy extends Model {
  get fullName() {
    return `${this.firstName} ${this.lastName}`
  }

  async hello(msg) {
    // await Promise.delay(180 * 1000)
    return `Hello ${this.fullName}: ${msg}`
  }

  static somethingStatic() {
    // NOTE: This will be present as a static member method:
    // Dummy.someStaticMethod()
  }

  static properties = properties
  static methods = methods
  static routes = routes
}
