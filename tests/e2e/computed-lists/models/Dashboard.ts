import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface Widget {
  title?: string | null
  sizes?: Record<string, { columns?: number | null }> | null
}

export interface Dashboard {
  id: number
  name: string
  widgets?: Widget[] | null
}

export class Dashboard extends Model {
  static override properties: ModelProperties = {
    name: { type: 'string', required: true },
    widgets: { type: 'array', nullable: true, items: { type: 'object' } }
  }
}
