import { defineEntity, p } from '@mikro-orm/core'

export interface CollectionChapter {
  name: string
}

export interface CollectionVolume {
  name: string
  chapters: CollectionChapter[]
}

const CollectionSchema = defineEntity({
  name: 'Collection',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    volumes: p.json<CollectionVolume[]>().nullable()
  }
})
export class Collection extends CollectionSchema.class {}
CollectionSchema.setClass(Collection)
