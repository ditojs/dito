import { defineEntity, p } from '@mikro-orm/core'
import { Widget } from './Widget.js'

const ItemSchema = defineEntity({
  name: 'Item',
  properties: {
    id: p.integer().primary(),
    widget: () => p.manyToOne(Widget),
    label: p.string(),
    order: p.integer().nullable()
  }
})
export class Item extends ItemSchema.class {}
ItemSchema.setClass(Item)
