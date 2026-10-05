import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface Draft {
  id: number
  name: string
  note?: string | null
  title?: string | null
  count?: number | null
  archived?: boolean | null
  published?: boolean | null
  size?: string | null
  features?: string[] | null
  tags?: string[] | null
  priority?: string | null
  code?: string | null
  rows?: { label: string }[] | null
  settings?: { mode?: string | null } | null
}

export class Draft extends Model {
  static override properties: ModelProperties = {
    name: { type: 'string', required: true },
    note: { type: 'string', nullable: true },
    title: { type: 'string', nullable: true },
    count: { type: 'integer', nullable: true },
    archived: { type: 'boolean', nullable: true },
    published: { type: 'boolean', nullable: true },
    size: { type: 'string', nullable: true },
    features: { type: 'array', nullable: true, items: { type: 'string' } },
    tags: { type: 'array', nullable: true, items: { type: 'string' } },
    priority: { type: 'string', nullable: true },
    code: { type: 'string', nullable: true },
    rows: { type: 'array', nullable: true, items: { type: 'object' } },
    settings: { type: 'object', nullable: true }
  }
}
