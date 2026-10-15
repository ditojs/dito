import type { FromModel } from '@ditojs/server'
import { Model, TimestampedModel } from '@ditojs/server'
import type * as models from './from-model-models'

export class Author extends Model {
  static override properties = {
    id: { type: 'integer', primary: true },
    name: { type: 'string', required: true },
    password: { type: 'string', hidden: true },
    fullName: { type: 'string', computed: true },
    favoriteBook: { type: 'Book', nullable: true }
  } as const

  static override relations = {
    books: { relation: 'hasMany', from: 'Author.id', to: 'Book.authorId' }
  } as const
}

export interface Author extends FromModel<typeof Author, typeof models> {}

export class Book extends TimestampedModel {
  static override properties = {
    id: { type: 'integer', primary: true },
    title: { type: 'string', required: true },
    authorId: { type: 'integer', foreign: true }
  } as const

  static override relations = {
    author: { relation: 'belongsTo', from: 'Book.authorId', to: 'Author.id' },
    chapters: { relation: 'hasMany', from: 'Book.id', to: 'Chapter.bookId' },
    tags: { relation: 'manyToMany', from: 'Book.id', to: 'Tag.id' },
    firstChapter: { relation: 'hasOne', from: 'Book.id', to: 'Chapter.bookId' },
    editor: {
      relation: 'hasOneThrough',
      from: 'Book.id',
      to: 'Person.id',
      modelClass: 'Author'
    },
    translator: {
      relation: 'belongsTo',
      from: 'Book.authorId',
      to: 'Person.id',
      modelClass: Author
    }
  } as const
}

export interface Book extends FromModel<typeof Book, typeof models> {}

export class Chapter extends Model {
  static override properties = {
    bookId: { type: 'integer', foreign: true, required: true }
  } as const

  static override relations = {
    book: { relation: 'belongsTo', from: 'Chapter.bookId', to: 'Book.id' }
  } as const
}

export interface Chapter extends FromModel<typeof Chapter, typeof models> {}

export class Tag extends Model {
  static override properties = {
    label: { type: 'string', required: true }
  } as const
}

export interface Tag extends FromModel<typeof Tag, typeof models> {}

// Definitions declared as const can only be extended, not replaced:
export class Novel extends Book {
  static override properties = {
    ...Book.properties,
    genre: { type: 'string', enum: ['crime', 'romance'] },
    secret: { type: 'string', hidden: true }
  } as const
}

export interface Novel extends FromModel<typeof Novel, typeof models> {}
