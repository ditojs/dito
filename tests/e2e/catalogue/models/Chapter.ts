import type { ModelProperties, QueryBuilder } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface Chapter {
  id: number
  bookId: number
  title: string
  summary: string | null
  order: number | null
}

export class Chapter extends Model {
  static override properties: ModelProperties = {
    // Graph saves set it from the relation, not from the request:
    bookId: { type: 'integer', index: true, nullable: true },
    title: { type: 'string', required: true },
    summary: { type: 'string', nullable: true },
    order: { type: 'integer', nullable: true }
  }

  static override scopes = {
    ordered: (query: QueryBuilder<Chapter>) =>
      query.orderBy('order').orderBy('id')
  }
}
