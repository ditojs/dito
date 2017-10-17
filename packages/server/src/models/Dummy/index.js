import Model from '../../core/Model'
import properties from './properties'
import relations from './relations'
import methods from './methods'
import routes from './routes'

export default class Dummy extends Model {
  static timestamps = true
  static properties = properties
  static relations = relations
  static methods = methods
  static routes = routes

  get fullName() {
    return `${this.firstName} ${this.lastName}`
  }

  async hello(msg) {
    return `Hello ${this.fullName}: ${msg}`
  }

  static async somethingStatic() {
    await Promise.delay(1000)
    return 'One second has passed.'
  }
}
