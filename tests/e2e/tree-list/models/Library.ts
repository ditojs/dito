import { defineEntity, p } from '@mikro-orm/core'

export interface Book {
  name: string
  order?: number
}

export interface Shelf {
  name: string
  order?: number
  books?: Book[]
}

export interface Catalog {
  title: string
  sections?: { name: string }[]
}

const LibrarySchema = defineEntity({
  name: 'Library',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    shelves: p.json<Shelf[]>().nullable(),
    catalog: p.json<Catalog>().nullable()
  }
})
export class Library extends LibrarySchema.class {}
LibrarySchema.setClass(Library)
