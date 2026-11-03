import { defineEntity, p } from '@mikro-orm/core'

export interface Author {
  id: number
  name: string
}

export interface Chapter {
  title: string
  wordCount?: number | null
  pageCount?: number | null
  code?: string | null
  note?: string | null
  author?: Author | null
}

export interface Volume {
  title: string
  parts?: Volume[] | null
}

const BookSchema = defineEntity({
  name: 'Book',
  properties: {
    id: p.integer().primary(),
    title: p.string(),
    chapters: p.json<Chapter[]>().nullable(),
    volumes: p.json<Volume[]>().nullable()
  }
})
export class Book extends BookSchema.class {}
BookSchema.setClass(Book)
