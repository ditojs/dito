import { defineEntity, p } from '@mikro-orm/core'

const TagSchema = defineEntity({
  name: 'Tag',
  properties: {
    id: p.integer().primary(),
    name: p.string()
  }
})
export class Tag extends TagSchema.class {}
TagSchema.setClass(Tag)
