import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

/** Data objects carry markers, to identify them in recorded contexts. */
interface Marked {
  marker: string
}

export interface Book extends Marked {
  id: number
  title?: string | null
  subtitle?: string | null
  edition?: string | null
  isbn?: string | null
  website?: string | null
  meta?: (Marked & { note?: string | null }) | null
  tags?: (Marked & { name?: string | null })[]
  chapters?: (Marked & { title?: string | null })[]
  notes?: (Marked & { text?: string | null })[]
  prices?: number[]
}

const json = { type: 'array', default: [], items: { type: 'object' } } as const

export class Book extends Model {
  static override properties: ModelProperties = {
    marker: { type: 'string' },
    title: { type: 'string', nullable: true },
    subtitle: { type: 'string', nullable: true },
    edition: { type: 'string', nullable: true },
    isbn: { type: 'string', nullable: true },
    website: { type: 'string', nullable: true },
    meta: { type: 'object', nullable: true },
    tags: json,
    chapters: json,
    notes: json,
    prices: { type: 'array', default: [], items: { type: 'number' } }
  }
}
