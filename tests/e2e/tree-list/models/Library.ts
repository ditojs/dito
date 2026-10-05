import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface Cut {
  name: string
  order?: number
}

export interface ShopSet {
  name: string
  order?: number
  cuts?: Cut[]
}

export interface Family {
  id: number
  name: string
  shopSets?: ShopSet[] | null
}

export class Family extends Model {
  static override properties: ModelProperties = {
    name: { type: 'string', required: true },
    shopSets: { type: 'array', nullable: true, items: { type: 'object' } }
  }
}
