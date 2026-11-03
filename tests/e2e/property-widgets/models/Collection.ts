import { defineEntity, p } from '@mikro-orm/core'

export interface CollectionCut {
  name: string
}

export interface CollectionShopSet {
  name: string
  cuts: CollectionCut[]
}

const CollectionSchema = defineEntity({
  name: 'Collection',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    shopSets: p.json<CollectionShopSet[]>().nullable()
  }
})
export class Collection extends CollectionSchema.class {}
CollectionSchema.setClass(Collection)
