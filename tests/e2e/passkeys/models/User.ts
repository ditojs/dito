import { UserModel } from '@ditojs/server'

export class User extends UserModel {
  declare id: number
  declare username: string
}
