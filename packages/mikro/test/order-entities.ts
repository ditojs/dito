import { defineEntity, p } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/sql'

// An order of a shop: an order owns its licenses and its shop
// items, and a license links shop items through a pivot entity with the
// composite primary key of its two foreign keys and the item's final prices
// in the license. `License.shopItems` owns the many-to-many relation,
// `ShopItem.licenses` is its inverse side. `License.legacyShopItems` links
// them through a pivot entity with an id of its own, as older tables have
// it. A license also bundles shop items, through a one-to-many relation that
// it doesn't own.

const ShopOrderSchema = defineEntity({
  name: 'ShopOrder',
  tableName: 'shop_order',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    licenses: () =>
      p
        .oneToMany(License)
        .mappedBy(license => license.shopOrder)
        .orphanRemoval()
        .orderBy({ id: 'asc' }),
    shopItems: () =>
      p
        .oneToMany(ShopItem)
        .mappedBy(shopItem => shopItem.shopOrder)
        .orphanRemoval()
        .orderBy({ id: 'asc' })
  }
})
export class ShopOrder extends ShopOrderSchema.class {}
ShopOrderSchema.setClass(ShopOrder)

const LicenseSchema = defineEntity({
  name: 'License',
  tableName: 'license',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    shopOrder: () => p.manyToOne(ShopOrder).nullable().deleteRule('cascade'),
    shopItems: () => p.manyToMany(ShopItem).pivotEntity(() => LicenseShopItem),
    legacyShopItems: () =>
      p.manyToMany(ShopItem).pivotEntity(() => LegacyLicenseShopItem),
    bundledItems: () => p.oneToMany(ShopItem).mappedBy(item => item.bundle)
  }
})
export class License extends LicenseSchema.class {}
LicenseSchema.setClass(License)

const ShopItemSchema = defineEntity({
  name: 'ShopItem',
  tableName: 'shop_item',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    shopOrder: () => p.manyToOne(ShopOrder).nullable().deleteRule('cascade'),
    licenses: () =>
      p.manyToMany(License).mappedBy(license => license.shopItems),
    legacyLicenses: () =>
      p.manyToMany(License).mappedBy(license => license.legacyShopItems),
    bundle: () => p.manyToOne(License).nullable()
  }
})
export class ShopItem extends ShopItemSchema.class {}
ShopItemSchema.setClass(ShopItem)

const LicenseShopItemSchema = defineEntity({
  name: 'LicenseShopItem',
  tableName: 'license_shop_item',
  properties: {
    license: () => p.manyToOne(License).primary().deleteRule('cascade'),
    shopItem: () => p.manyToOne(ShopItem).primary().deleteRule('cascade'),
    finalPrice: p.integer().nullable(),
    finalPriceBeforeDiscount: p.double().nullable()
  }
})
export class LicenseShopItem extends LicenseShopItemSchema.class {}
LicenseShopItemSchema.setClass(LicenseShopItem)

const LegacyLicenseShopItemSchema = defineEntity({
  name: 'LegacyLicenseShopItem',
  tableName: 'legacy_license_shop_item',
  uniques: [{ properties: ['license', 'shopItem'] }],
  properties: {
    id: p.integer().primary(),
    license: () => p.manyToOne(License).nullable().deleteRule('cascade'),
    shopItem: () => p.manyToOne(ShopItem).nullable().deleteRule('cascade'),
    finalPrice: p.integer().nullable()
  }
})
export class LegacyLicenseShopItem extends LegacyLicenseShopItemSchema.class {}
LegacyLicenseShopItemSchema.setClass(LegacyLicenseShopItem)

export const orderEntities = [
  ShopOrder,
  License,
  ShopItem,
  LicenseShopItem,
  LegacyLicenseShopItem
]

// The order of the tests with `populate`.
export const loadOrder = (em: EntityManager, populate: string[]) =>
  em.findOneOrFail(ShopOrder, 1, { populate: populate as never[] })
