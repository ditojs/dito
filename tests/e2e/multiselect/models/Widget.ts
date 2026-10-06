import type {
  ModelProperties,
  ModelRelations,
  QueryBuilder
} from '@ditojs/server'
import { Model } from '@ditojs/server'
import { Tag } from './Tag.js'

export interface Widget {
  id: number
  name: string
  size?: string | null
  shape?: string | null
  color?: string | null
  paint?: string | null
  codes?: string[] | null
  tags?: Tag[]
}

export class Widget extends Model {
  static override properties: ModelProperties = {
    name: { type: 'string', required: true },
    size: { type: 'string', nullable: true },
    shape: { type: 'string', nullable: true },
    color: { type: 'string', nullable: true },
    paint: { type: 'string', nullable: true },
    codes: { type: 'array', nullable: true, items: { type: 'string' } }
  }

  static override relations: ModelRelations = {
    tags: {
      relation: 'manyToMany',
      from: 'Widget.id',
      to: 'Tag.id'
    }
  }

  static override scopes = {
    // Eager-load tags so the admin form re-hydrates the multiselect after
    // reload. Applied as `^withTags` on the Widgets controller below so
    // every query goes through this scope.
    withTags: (query: QueryBuilder<Widget>) => query.withGraphFetched('tags')
  }
}
