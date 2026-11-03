import { defineEntity, p } from '@mikro-orm/core'

const SecretSchema = defineEntity({
  name: 'Secret',
  properties: {
    id: p.integer().primary(),
    name: p.string()
  }
})
export class Secret extends SecretSchema.class {}
SecretSchema.setClass(Secret)
