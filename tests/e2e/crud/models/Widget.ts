import { defineEntity, p } from '@mikro-orm/core'

const WidgetSchema = defineEntity({
  name: 'Widget',
  properties: {
    id: p.integer().primary(),
    name: p.string()
  }
})
export class Widget extends WidgetSchema.class {}
WidgetSchema.setClass(Widget)
