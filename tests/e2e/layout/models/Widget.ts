import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface Widget {
  id: number
  name: string
  notes?: string | null
  settings?: { color?: string } | null
  size?: string | null
  links?: { url?: string; parts?: { name?: string }[] }[] | null
}

export class Widget extends Model {
  static override properties: ModelProperties = {
    name: { type: 'string', required: true },
    notes: { type: 'text', nullable: true },
    settings: { type: 'object', nullable: true },
    size: { type: 'string', nullable: true },
    links: { type: 'array', nullable: true, items: { type: 'object' } }
  }
}
