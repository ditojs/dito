import { defineEntity, p } from '@mikro-orm/core'

// A reduced font-family graph: a family owns its sets, a set owns its cuts,
// and a family has designers through a many-to-many relation and awards it
// doesn't own. `specs` and `documents` are JSON columns.

const FamilySchema = defineEntity({
  name: 'Family',
  tableName: 'family',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    notes: p.text().nullable(),
    published: p.boolean().default(false),
    specs: p.json<{ weight?: number; tags?: string[] }>().nullable(),
    documents: p.json<object[]>().nullable(),
    // Never part of a response.
    secret: p.string().nullable().hidden(),
    nameLength: p.integer().formula(cols => `length(${cols.name})`),
    sets: () =>
      p
        .oneToMany(FontSet)
        .mappedBy(set => set.family)
        .orphanRemoval()
        .orderBy({ order: 'asc', id: 'asc' }),
    designers: () => p.manyToMany(Designer),
    awards: () => p.oneToMany(Award).mappedBy(award => award.family),
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
    set: () => p.manyToOne(FontSet)
  }
})
export class Cut extends CutSchema.class {}
CutSchema.setClass(Cut)

const DesignerSchema = defineEntity({
  name: 'Designer',
  tableName: 'designer',
  properties: {
    id: p.integer().primary(),
    name: p.string()
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
    family: () => p.manyToOne(Family)
  }
})
export class Award extends AwardSchema.class {}
AwardSchema.setClass(Award)

export const entities = [Family, FontSet, Cut, Designer, Award]
