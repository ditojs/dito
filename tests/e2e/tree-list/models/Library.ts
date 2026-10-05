import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

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

export interface Library {
  id: number
  name: string
  shelves?: Shelf[] | null
  catalog?: Catalog | null
}

export class Library extends Model {
  static override properties: ModelProperties = {
    name: { type: 'string', required: true },
    shelves: { type: 'array', nullable: true, items: { type: 'object' } },
    catalog: { type: 'object', nullable: true }
  }
}
