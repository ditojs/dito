import type {
  ModelProperties,
  ModelRelations,
  QueryBuilder
} from '@ditojs/server'
import { Model } from '@ditojs/server'
import type { Chapter } from './Chapter.js'

export interface Book {
  id: number
  title: string
  author: string
  year: number
  pages: number
  available: boolean
  chapters?: Chapter[]
}

export class Book extends Model {
  static override properties: ModelProperties = {
    title: { type: 'string', required: true },
    author: { type: 'string', required: true },
    year: { type: 'integer' },
    pages: { type: 'integer' },
    available: { type: 'boolean', default: true }
  }

  static override relations: ModelRelations = {
    chapters: {
      relation: 'hasMany',
      from: 'Book.id',
      to: 'Chapter.bookId',
      owner: true,
      scope: 'ordered'
    }
  }

  static override scopes = {
    available: (query: QueryBuilder<Book>) => query.where('available', true),
    lent: (query: QueryBuilder<Book>) => query.where('available', false),
    withChapters: (query: QueryBuilder<Book>) =>
      query.withGraphFetched('chapters')
  }

  static override filters = {
    search(query: QueryBuilder<Book>, search: string) {
      query
        .whereILike('title', `%${search}%`)
        .orWhereILike('author', `%${search}%`)
    }
  }
}
