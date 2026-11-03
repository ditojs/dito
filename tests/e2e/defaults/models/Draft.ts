import { defineEntity, p } from '@mikro-orm/core'

const DraftSchema = defineEntity({
  name: 'Draft',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    note: p.string().nullable(),
    title: p.string().nullable(),
    count: p.integer().nullable(),
    archived: p.boolean().nullable(),
    published: p.boolean().nullable(),
    size: p.string().nullable(),
    features: p.json<string[]>().nullable(),
    tags: p.json<string[]>().nullable(),
    priority: p.string().nullable(),
    code: p.string().nullable(),
    rows: p.json<{ label: string }[]>().nullable(),
    settings: p.json<{ mode?: string | null }>().nullable()
  }
})
export class Draft extends DraftSchema.class {}
DraftSchema.setClass(Draft)
