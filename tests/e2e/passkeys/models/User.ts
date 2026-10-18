import type { ModelProperties } from '@ditojs/server'
import { UserModel } from '@ditojs/server'

export class User extends UserModel {
  declare id: number
  declare username: string

  // A getter, as `UserMixin` defines `properties` as one:
  static override get properties(): ModelProperties {
    return {
      password: {
        type: 'string',
        computed: true,
        minLength: 6
      }
    }
  }
}
