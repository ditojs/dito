import { defineEntity, p } from '@mikro-orm/core'

// A basket holds products through a pivot entity with the composite primary
// key of its two foreign keys, and columns of its own: a required quantity
// and a price. `Basket.lines` owns the pivot rows, and `Basket.products` links
// the same rows as a many-to-many relation.

const BasketSchema = defineEntity({
  name: 'Basket',
  tableName: 'basket',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    products: () => p.manyToMany(Product).pivotEntity(() => BasketProduct),
    lines: () =>
      p
        .oneToMany(BasketProduct)
        .mappedBy(line => line.basket)
        .orphanRemoval()
  }
})
export class Basket extends BasketSchema.class {}
BasketSchema.setClass(Basket)

const ProductSchema = defineEntity({
  name: 'Product',
  tableName: 'product',
  properties: {
    id: p.integer().primary(),
    name: p.string()
  }
})
export class Product extends ProductSchema.class {}
ProductSchema.setClass(Product)

const BasketProductSchema = defineEntity({
  name: 'BasketProduct',
  tableName: 'basket_product',
  properties: {
    basket: () => p.manyToOne(Basket).primary().deleteRule('cascade'),
    product: () => p.manyToOne(Product).primary().deleteRule('cascade'),
    quantity: p.integer(),
    price: p.integer().nullable()
  }
})
export class BasketProduct extends BasketProductSchema.class {}
BasketProductSchema.setClass(BasketProduct)

export const basketEntities = [Basket, Product, BasketProduct]
