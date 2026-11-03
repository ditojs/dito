import { defineEntity, p } from '@mikro-orm/core'

/** Data objects carry markers, to identify them in recorded contexts. */
interface Marked {
  marker: string
}

const items = <T>() => p.json<(Marked & T)[]>().onCreate(() => [])

const BookSchema = defineEntity({
  name: 'Book',
  properties: {
    id: p.integer().primary(),
    marker: p.string(),
    title: p.string().nullable(),
    subtitle: p.string().nullable(),
    edition: p.string().nullable(),
    isbn: p.string().nullable(),
    website: p.string().nullable(),
    meta: p.json<Marked & { note?: string | null }>().nullable(),
    tags: items<{ name?: string | null }>(),
    chapters: items<{ title?: string | null }>(),
    notes: items<{ text?: string | null }>(),
    prices: p.json<number[]>().onCreate(() => [])
  }
})
export class Book extends BookSchema.class {}
BookSchema.setClass(Book)
