import { defineEntity, p } from '@mikro-orm/core'

const WidgetSchema = defineEntity({
  name: 'Widget',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    published: p.boolean().default(false)
  }
})
export class Widget extends WidgetSchema.class {}
WidgetSchema.setClass(Widget)
