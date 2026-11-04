import { z } from 'zod'
import { StringType, defineEntity, p } from '@mikro-orm/core'
import type { AssetFileObject } from '@ditojs/storage'
import { schemaJson } from '../src/index.ts'

// A string column whose schema is async: a code of upper-case letters.
const codeSchema = z
  .string()
  .refine(async value => /^[A-Z]+$/.test(value), 'Invalid code')

class CodeType extends StringType {
  get schema() {
    return codeSchema
  }
}

// A graph of test entities: a family owns its sets and its info, a set owns
// its cuts, and a family has designers through a many-to-many relation and
// awards it doesn't own. `specs`, `documents` and `features` are JSON
// columns, `specs`, `features` and `code` have schemas, and `documents` holds
// files. A family's name and notes are unique together. `rating` and a
// designer's `email` belong to the `admin` serialization group.

const FamilySchema = defineEntity({
  name: 'Family',
  tableName: 'family',
  uniques: [{ properties: ['name', 'notes'] }],
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    notes: p.text().nullable(),
    published: p.boolean().default(false),
    specs: schemaJson(
      z.strictObject({
        weight: z.number().optional(),
        tags: z.array(z.string()).optional()
      })
    ).nullable(),
    documents: p.json<AssetFileObject[]>().nullable(),
    // Never part of a response.
    secret: p.string().nullable().hidden(),
    rating: p.integer().nullable(),
    nameLength: p.integer().formula(cols => `length(${cols.name})`),
    sets: () =>
      p
        .oneToMany(FontSet)
        .mappedBy(set => set.family)
        .orphanRemoval()
        .orderBy({ order: 'asc', id: 'asc' }),
    designers: () => p.manyToMany(Designer),
    awards: () => p.oneToMany(Award).mappedBy(award => award.family),
    info: () =>
      p
        .oneToOne(Info)
        .mappedBy(info => info.family)
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
export class Family extends FamilySchema.class {}
FamilySchema.setClass(Family)

const FontSetSchema = defineEntity({
  name: 'FontSet',
  tableName: 'font_set',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    order: p.integer().nullable(),
    family: () => p.manyToOne(Family),
    defaultCut: () => p.manyToOne(Cut).nullable(),
    cuts: () =>
      p
        .oneToMany(Cut)
        .mappedBy(cut => cut.set)
        .orphanRemoval()
        .orderBy({ order: 'asc', id: 'asc' })
  }
})
export class FontSet extends FontSetSchema.class {}
FontSetSchema.setClass(FontSet)

const CutSchema = defineEntity({
  name: 'Cut',
  tableName: 'font_cut',
  uniques: [{ properties: ['set', 'name'] }],
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    order: p.integer().nullable(),
    code: p.string().type(new CodeType()).nullable(),
    features: schemaJson(z.array(z.object({ tag: z.string().length(4) })))
      .nullable(),
    set: () => p.manyToOne(FontSet)
  }
})
export class Cut extends CutSchema.class {}
CutSchema.setClass(Cut)

// Deleted designers are left out of every query, by a default filter. `bio`
// and `awardCount` are lazy.
const DesignerSchema = defineEntity({
  name: 'Designer',
  tableName: 'designer',
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
          `(select count(*)::int from award where award.designer_id = ${
            cols.id
          })`
      )
      .lazy(),
    families: () => p.manyToMany(Family).mappedBy(family => family.designers)
  }
})
export class Designer extends DesignerSchema.class {}
DesignerSchema.setClass(Designer)

const AwardSchema = defineEntity({
  name: 'Award',
  tableName: 'award',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    family: () => p.manyToOne(Family),
    designer: () => p.manyToOne(Designer).nullable(),
    // Never part of a response.
    judge: () => p.manyToOne(Designer).nullable().hidden(),
    jury: () => p.manyToOne(Designer).nullable()
  }
})
export class Award extends AwardSchema.class {}
AwardSchema.setClass(Award)

// The owned row of a one-to-one relation. `familyCode` is ten times the
// foreign key.
const InfoSchema = defineEntity({
  name: 'Info',
  tableName: 'info',
  properties: {
    id: p.integer().primary(),
    text: p.string(),
    family: () => p.oneToOne(Family).owner(),
    familyCode: p.integer().formula(cols => `${cols.family} * 10`)
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

export const entities = [Family, FontSet, Cut, Designer, Award, Info, Pair]
