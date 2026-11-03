import { defineEntity, p } from '@mikro-orm/core'

interface Link {
  url?: string
  image?: { name: string; type: string; size: number; url?: string }
  parts?: { name?: string }[]
}

const WidgetSchema = defineEntity({
  name: 'Widget',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    notes: p.text().nullable(),
    settings: p.json<{ color?: string }>().nullable(),
    size: p.string().nullable(),
    links: p.json<Link[]>().nullable()
  }
})
export class Widget extends WidgetSchema.class {}
WidgetSchema.setClass(Widget)
