import { z } from 'zod'
import { StringType, defineEntity, p } from '@mikro-orm/core'
import type { AssetFile } from '@ditojs/storage'
import { defineJsonType } from '../src/index.ts'

// A string column whose schema is async: a code of upper-case letters.
const codeSchema = z
  .string()
  .refine(async value => /^[A-Z]+$/.test(value), 'Invalid code')

class CodeType extends StringType {
  get schema() {
    return codeSchema
  }
}

// A graph of test entities: a book owns its parts and its info, a part owns
// its chapters, and a book has authors through a many-to-many relation and
// awards it doesn't own. `specs`, `documents` and `keywords` are JSON
// columns, `specs`, `keywords` and `code` have schemas, and `documents` holds
// files. A book's name and notes are unique together. `rating` and an
// author's `email` belong to the `admin` serialization group.

const BookSchema = defineEntity({
  name: 'Book',
  tableName: 'book',
  uniques: [{ properties: ['name', 'notes'] }],
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    notes: p.text().nullable(),
    published: p.boolean().default(false),
    specs: p
      .type(
        defineJsonType({
          schema: z.strictObject({
            pages: z.number().optional(),
            tags: z.array(z.string()).optional()
          })
        })
      )
      .nullable(),
    documents: p.json<AssetFile[]>().nullable(),
    // Never part of a response.
    secret: p.string().nullable().hidden(),
    rating: p.integer().nullable(),
    nameLength: p.integer().formula(cols => `length(${cols.name})`),
    parts: () =>
      p
        .oneToMany(Part)
        .mappedBy(part => part.book)
        .orphanRemoval()
        .orderBy({ order: 'asc', id: 'asc' }),
    authors: () => p.manyToMany(Author),
    awards: () => p.oneToMany(Award).mappedBy(award => award.book),
    info: () =>
      p
        .oneToOne(Info)
        .mappedBy(info => info.book)
        .orphanRemoval()
        .nullable(),
    releasedAt: p.datetime().nullable(),
    createdAt: p.datetime().onCreate(() => new Date()),
    updatedAt: p
      .datetime()
      .onCreate(() => new Date())
      .onUpdate(() => new Date())
  }
})
export class Book extends BookSchema.class {}
BookSchema.setClass(Book)

const PartSchema = defineEntity({
  name: 'Part',
  tableName: 'part',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    order: p.integer().nullable(),
    book: () => p.manyToOne(Book),
    defaultChapter: () => p.manyToOne(Chapter).nullable(),
    chapters: () =>
      p
        .oneToMany(Chapter)
        .mappedBy(chapter => chapter.part)
        .orphanRemoval()
        .orderBy({ order: 'asc', id: 'asc' })
  }
})
export class Part extends PartSchema.class {}
PartSchema.setClass(Part)

const ChapterSchema = defineEntity({
  name: 'Chapter',
  tableName: 'chapter',
  uniques: [{ properties: ['part', 'name'] }],
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    order: p.integer().nullable(),
    code: p.string().type(new CodeType()).nullable(),
    keywords: p
      .type(
        defineJsonType({
          schema: z.array(z.object({ tag: z.string().length(4) }))
        })
      )
      .nullable(),
    part: () => p.manyToOne(Part)
  }
})
export class Chapter extends ChapterSchema.class {}
ChapterSchema.setClass(Chapter)

// Deleted authors are left out of every query, by a default filter. `bio`
// and `awardCount` are lazy.
const AuthorSchema = defineEntity({
  name: 'Author',
  tableName: 'author',
  filters: {
    active: { name: 'active', cond: { deleted: false }, default: true }
  },
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    deleted: p.boolean().default(false),
    email: p.string().nullable(),
    // Loaded only when a query asks for it.
    bio: p.text().nullable().lazy(),
    // A lazy formula, loaded only when a query names it.
    awardCount: p
      .integer()
      .formula(
        cols =>
          `(select count(*)::int from award where award.author_id = ${
            cols.id
          })`
      )
      .lazy(),
    books: () => p.manyToMany(Book).mappedBy(book => book.authors)
  }
})
export class Author extends AuthorSchema.class {}
AuthorSchema.setClass(Author)

const AwardSchema = defineEntity({
  name: 'Award',
  tableName: 'award',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    book: () => p.manyToOne(Book),
    author: () => p.manyToOne(Author).nullable(),
    // Never part of a response.
    judge: () => p.manyToOne(Author).nullable().hidden(),
    jury: () => p.manyToOne(Author).nullable()
  }
})
export class Award extends AwardSchema.class {}
AwardSchema.setClass(Award)

// The owned row of a one-to-one relation. `bookCode` is ten times the
// foreign key.
const InfoSchema = defineEntity({
  name: 'Info',
  tableName: 'info',
  properties: {
    id: p.integer().primary(),
    text: p.string(),
    book: () => p.oneToOne(Book).owner(),
    bookCode: p.integer().formula(cols => `${cols.book} * 10`)
  }
})
export class Info extends InfoSchema.class {}
InfoSchema.setClass(Info)

// A composite primary key, which controllers refuse.
const PairSchema = defineEntity({
  name: 'Pair',
  tableName: 'pair',
  properties: {
    left: p.integer().primary(),
    right: p.integer().primary()
  }
})
export class Pair extends PairSchema.class {}
PairSchema.setClass(Pair)

export const entities = [Book, Part, Chapter, Author, Award, Info, Pair]
