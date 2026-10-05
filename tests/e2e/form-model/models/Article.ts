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
}

export class Article extends Model {
  static override properties: ModelProperties = {
    title: { type: 'string', required: true },
    slug: { type: 'string', nullable: true },
    titleLength: { type: 'integer', nullable: true },
    status: { type: 'string', nullable: true },
    category: { type: 'string', nullable: true },
    topic: { type: 'string', nullable: true }
  }
}
