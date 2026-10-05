import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface Section {
  title: string
}

export interface Chapter {
  title: string
  summary?: string | null
  sections?: Section[]
}

export interface Volume {
  title?: string | null
  parts?: { title?: string | null }[]
}

export interface Book {
  id: number
  title: string
  subtitle?: string | null
  edition?: string | null
  fillEdition?: never
  publisher?: string | null
  meta?: { note?: string } | null
  credits?: { editor?: string | null } | null
  tags?: { name: string }[]
  chapters?: Chapter[]
  volumes?: Volume[]
}

// Titles must start with an uppercase letter. Only the server knows this rule,
// so the admin learns about violations through the server's errors.
const title = { type: 'string', pattern: '^[A-Z]', nullable: true } as const

export class Book extends Model {
  static override properties: ModelProperties = {
    title: { ...title, nullable: false, required: true },
    subtitle: title,
    edition: { type: 'string', nullable: true },
    publisher: { type: 'string', nullable: true },
    meta: {
      type: 'object',
      nullable: true,
      properties: { note: title }
    },
    credits: {
      type: 'object',
      nullable: true,
      properties: { editor: { type: 'string', nullable: true } }
    },
    tags: {
      type: 'array',
      default: [],
      items: { type: 'object', properties: { name: title } }
    },
    chapters: {
      type: 'array',
      default: [],
      items: {
        type: 'object',
        properties: {
          title,
          summary: { type: 'string', nullable: true },
          sections: {
            type: 'array',
            nullable: true,
            items: { type: 'object', properties: { title } }
          }
        }
      }
    },
    volumes: {
      type: 'array',
      default: [],
      items: {
        type: 'object',
        properties: {
          title,
          parts: {
            type: 'array',
            nullable: true,
            items: { type: 'object', properties: { title } }
          }
        }
      }
    }
  }
}
