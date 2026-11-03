import { defineEntity, p } from '@mikro-orm/core'

const VaultSchema = defineEntity({
  name: 'Vault',
  properties: {
    id: p.integer().primary(),
    name: p.string()
  }
})
export class Vault extends VaultSchema.class {}
VaultSchema.setClass(Vault)
