import { defineEntity, p } from '@mikro-orm/core'

const PageSchema = defineEntity({
  name: 'Page',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    order: p.integer().nullable(),
    parentPage: () => p.manyToOne(Page).nullable().deleteRule('cascade'),
    childPages: () =>
      p
        .oneToMany(Page)
        .mappedBy(page => page.parentPage)
        .orphanRemoval()
        .orderBy({ order: 'asc' })
  }
})
export class Page extends PageSchema.class {}
PageSchema.setClass(Page)
