import { defineEntity, p } from '@mikro-orm/core'

const UserSchema = defineEntity({
  name: 'User',
  properties: {
    id: p.integer().primary(),
    username: p.string().unique(),
    email: p.string(),
    hash: p.string().nullable().hidden(),
    roles: p.json<string[]>().nullable(),
    lastLogin: p.datetime().nullable()
  }
})
export class User extends UserSchema.class {}
UserSchema.setClass(User)
