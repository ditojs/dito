import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface CollectionCut {
  name: string
}

export interface CollectionShopSet {
  name: string
  cuts: CollectionCut[]
}

export interface Collection {
  id: number
  name: string
  shopSets?: CollectionShopSet[]
}

export class Collection extends Model {
  static override properties: ModelProperties = {
    name: { type: 'string', required: true },
    shopSets: { type: 'array', items: { type: 'object' } }
  }
}
