import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface Article {
  id: number
  title: string
  slug?: string | null
  titleLength?: number | null
  status?: string | null
  category?: string | null
  topic?: string | null
  chooser?: {
    source?: { topics?: { label: string; value: string }[] }
    topic?: string | null
  } | null
  lines?: { amount?: number | null }[] | null
  customFactor?: number | null
  tags?: string[] | null
  keywords?: (string | null)[]
}

export class Article extends Model {
  static override properties: ModelProperties = {
    title: { type: 'string', required: true },
    slug: { type: 'string', nullable: true },
    titleLength: { type: 'integer', nullable: true },
    status: { type: 'string', nullable: true },
    category: { type: 'string', nullable: true },
    topic: { type: 'string', nullable: true },
    chooser: { type: 'object', nullable: true },
    lines: { type: 'array', nullable: true, items: { type: 'object' } },
    customFactor: { type: 'number', nullable: true },
    tags: { type: 'array', nullable: true, items: { type: 'string' } },
    keywords: {
      type: 'array',
      default: [],
      items: { type: 'string', nullable: true }
    }
  }
}
