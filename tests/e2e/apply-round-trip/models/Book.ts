import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

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

export interface Book {
  id: number
  title: string
  chapters?: Chapter[] | null
  volumes?: Volume[] | null
}

export class Book extends Model {
  static override properties: ModelProperties = {
    title: { type: 'string', required: true },
    chapters: { type: 'array', nullable: true, items: { type: 'object' } },
    volumes: { type: 'array', nullable: true, items: { type: 'object' } }
  }
}
