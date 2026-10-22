import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface Cut {
  type: 'style' | 'bundle'
  name?: string
  title?: string
  discount?: number
}

export interface ShopSet {
  id: number
  name: string
  prices?: number[]
  cuts?: Cut[]
}

export class ShopSet extends Model {
  static override properties: ModelProperties = {
    name: { type: 'string', required: true },
    prices: { type: 'array', items: { type: 'number', minimum: 0 } },
    cuts: { type: 'array', items: { type: 'object' } }
  }
}
