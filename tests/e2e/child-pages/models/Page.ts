import type {
  ModelProperties,
  ModelRelations,
  QueryBuilder
} from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface Page {
  id: number
  name: string
  order: number | null
  parentPageId?: number | null
  childPages?: Page[]
}

export class Page extends Model {
  static override properties: ModelProperties = {
    name: { type: 'string', required: true },
    order: { type: 'integer', nullable: true },
    parentPageId: { type: 'integer', index: true, nullable: true }
  }

  static override relations: ModelRelations = {
    childPages: {
      relation: 'hasMany',
      from: 'Page.id',
      to: 'Page.parentPageId',
      owner: true,
      scope: 'ordered'
    }
  }

  static override scopes = {
    ordered: (query: QueryBuilder<Page>) => query.orderBy('order')
  }
}
