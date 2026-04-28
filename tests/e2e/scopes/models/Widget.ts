import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'
import type { QueryBuilder } from 'objection'

export interface Widget {
  id: number
  name: string
  published: boolean
}

export class Widget extends Model {
  static override properties: ModelProperties = {
    name: { type: 'string', required: true },
    published: { type: 'boolean', default: false }
  }

  static override scopes = {
    published: (query: QueryBuilder<Widget>) => query.where('published', true),
    unpublished: (query: QueryBuilder<Widget>) =>
      query.where('published', false)
  }

  static override filters = {
    search(query: QueryBuilder<Widget>, search: string) {
      query.whereILike('name', `%${search}%`)
    }
  }
}
