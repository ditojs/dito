import type { ModelProperties, RelationMappings } from '@ditojs/server'
import { Model } from '@ditojs/server'
import type { QueryBuilder } from 'objection'
import { Item } from './Item.js'

export interface Widget {
  id: number
  name: string
  items?: Item[]
}

export class Widget extends Model {
  static override properties: ModelProperties = {
    name: { type: 'string', required: true }
  }

  static override relations: RelationMappings = {
    items: {
      relation: 'hasMany',
      from: 'Widget.id',
      to: 'Item.widgetId',
      // `owner: true` tells Dito the parent fully owns the children, so a
      // graph save inserts/updates/deletes child rows with their data
      // (label, etc.) rather than treating incoming items as relate-by-id
      // references.
      owner: true
    }
  }

  static override scopes = {
    // Eager-load items so the admin form re-hydrates the nested list on
    // edit reload. Applied as `^withItems` on the Widgets controller in
    // fixtures.ts so every query goes through this scope.
    withItems: (query: QueryBuilder<Widget>) =>
      query.withGraphFetched('items')
  }
}
