import { defineEntity, p } from '@mikro-orm/core'
import { Tag } from './Tag.js'

const WidgetSchema = defineEntity({
  name: 'Widget',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    size: p.string().nullable(),
    shape: p.string().nullable(),
    color: p.string().nullable(),
    paint: p.string().nullable(),
    codes: p.json<string[]>().nullable(),
    tags: () => p.manyToMany(Tag)
  }
})
export class Widget extends WidgetSchema.class {}
WidgetSchema.setClass(Widget)
