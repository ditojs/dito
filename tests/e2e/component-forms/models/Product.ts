import { defineEntity, p } from '@mikro-orm/core'

const ProductSchema = defineEntity({
  name: 'Product',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    price: p.integer().nullable()
  }
})
export class Product extends ProductSchema.class {}
ProductSchema.setClass(Product)
