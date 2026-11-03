import { defineEntity, p } from '@mikro-orm/core'
import { schemaJson } from '@ditojs/mikro'
import { z } from 'zod'

export interface Cut {
  type: 'style' | 'bundle'
  name?: string
  title?: string
  discount?: number
}

const ShopSetSchema = defineEntity({
  name: 'ShopSet',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    prices: schemaJson(z.array(z.number().min(0))).nullable(),
    cuts: p.json<Cut[]>().nullable()
  }
})
export class ShopSet extends ShopSetSchema.class {}
ShopSetSchema.setClass(ShopSet)
