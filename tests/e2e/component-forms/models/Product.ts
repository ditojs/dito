import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface Product {
  id: number
  name: string
  price?: number | null
}

export class Product extends Model {
  static override properties: ModelProperties = {
    name: { type: 'string', required: true },
    price: { type: 'integer', nullable: true }
  }
}
