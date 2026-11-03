import { defineEntity, p } from '@mikro-orm/core'

export interface Entry {
  title: string
}

const entries = () => p.json<Entry[]>().nullable()

const BookSchema = defineEntity({
  name: 'Book',
  properties: {
    id: p.integer().primary(),
    title: p.string(),
    chapters: entries(),
    appendices: entries(),
    contents: p.json<{ notes?: Entry[] | null }>().nullable(),
    quotes: entries(),
    meta: p.json<{ sources?: Entry[] | null }>().nullable(),
    sourceURLs: entries()
  }
})
export class Book extends BookSchema.class {}
BookSchema.setClass(Book)
