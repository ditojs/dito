import type { ModelProperties, ModelProperty } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface Entry {
  title: string
}

export interface Book {
  id: number
  title: string
  chapters?: Entry[] | null
  appendices?: Entry[] | null
  contents?: { notes?: Entry[] | null } | null
  // Sections that aren't nested hold no data of their own.
  more: never
  quotes?: Entry[] | null
  meta?: { sources?: Entry[] | null } | null
  sourceURLs?: Entry[] | null
}

const entries: ModelProperty = {
  type: 'array',
  nullable: true,
  items: { type: 'object' }
}

export interface Shelf {
  // Labels hold no data.
  intro?: never
  shelfBooks?: Book[] | null
}

export class Book extends Model {
  static override properties: ModelProperties = {
    title: { type: 'string', required: true },
    chapters: entries,
    appendices: entries,
    contents: { type: 'object', nullable: true },
    quotes: entries,
    meta: { type: 'object', nullable: true },
    sourceURLs: entries
  }
}
