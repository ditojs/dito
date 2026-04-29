import type { ModelProperties, RelationMappings } from '@ditojs/server'
import { Model } from '@ditojs/server'
import type { QueryBuilder } from 'objection'
import { Tag } from './Tag.js'

export interface Widget {
  id: number
  name: string
  tags?: Tag[]
}

export class Widget extends Model {
  static override properties: ModelProperties = {
    name: { type: 'string', required: true }
  }

  static override relations: RelationMappings = {
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
    withTags: (query: QueryBuilder<Widget>) =>
      query.withGraphFetched('tags')
  }
}
