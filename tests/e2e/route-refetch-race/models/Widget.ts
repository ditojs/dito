import { defineEntity, p } from '@mikro-orm/core'
import { Item } from './Item.js'

const WidgetSchema = defineEntity({
  name: 'Widget',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    // The widget owns its items, so bodies write them nested.
    items: () =>
      p
        .oneToMany(Item)
        .mappedBy(item => item.widget)
        .orphanRemoval()
        .orderBy({ id: 'asc' })
  }
})
export class Widget extends WidgetSchema.class {}
WidgetSchema.setClass(Widget)
