import { defineEntity, p } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/sql'

// A library owns its reading lists and its volumes, and a reading list links
// volumes through a pivot entity with the composite primary key of its two
// foreign keys and the volume's fees in the list. `ReadingList.volumes` owns
// the many-to-many relation, `Volume.readingLists` is its inverse side.
// `ReadingList.legacyVolumes` links them through a pivot entity with an id of
// its own, as older tables have it. A reading list also bundles volumes,
// through a one-to-many relation that it doesn't own.

const LibrarySchema = defineEntity({
  name: 'Library',
  tableName: 'library',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    readingLists: () =>
      p
        .oneToMany(ReadingList)
        .mappedBy(readingList => readingList.library)
        .orphanRemoval()
        .orderBy({ id: 'asc' }),
    volumes: () =>
      p
        .oneToMany(Volume)
        .mappedBy(volume => volume.library)
        .orphanRemoval()
        .orderBy({ id: 'asc' })
  }
})
export class Library extends LibrarySchema.class {}
LibrarySchema.setClass(Library)

const ReadingListSchema = defineEntity({
  name: 'ReadingList',
  tableName: 'reading_list',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    library: () => p.manyToOne(Library).nullable().deleteRule('cascade'),
    volumes: () => p.manyToMany(Volume).pivotEntity(() => ReadingListVolume),
    legacyVolumes: () =>
      p.manyToMany(Volume).pivotEntity(() => LegacyReadingListVolume),
    bundledItems: () => p.oneToMany(Volume).mappedBy(item => item.bundle)
  }
})
export class ReadingList extends ReadingListSchema.class {}
ReadingListSchema.setClass(ReadingList)

const VolumeSchema = defineEntity({
  name: 'Volume',
  tableName: 'volume',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    library: () => p.manyToOne(Library).nullable().deleteRule('cascade'),
    readingLists: () =>
      p.manyToMany(ReadingList).mappedBy(readingList => readingList.volumes),
    legacyReadingLists: () =>
      p
        .manyToMany(ReadingList)
        .mappedBy(readingList => readingList.legacyVolumes),
    bundle: () => p.manyToOne(ReadingList).nullable()
  }
})
export class Volume extends VolumeSchema.class {}
VolumeSchema.setClass(Volume)

const ReadingListVolumeSchema = defineEntity({
  name: 'ReadingListVolume',
  tableName: 'reading_list_volume',
  properties: {
    readingList: () => p.manyToOne(ReadingList).primary().deleteRule('cascade'),
    volume: () => p.manyToOne(Volume).primary().deleteRule('cascade'),
    fee: p.integer().nullable(),
    feeBeforeDiscount: p.double().nullable()
  }
})
export class ReadingListVolume extends ReadingListVolumeSchema.class {}
ReadingListVolumeSchema.setClass(ReadingListVolume)

const LegacyReadingListVolumeSchema = defineEntity({
  name: 'LegacyReadingListVolume',
  tableName: 'legacy_reading_list_volume',
  uniques: [{ properties: ['readingList', 'volume'] }],
  properties: {
    id: p.integer().primary(),
    readingList: () =>
      p.manyToOne(ReadingList).nullable().deleteRule('cascade'),
    volume: () => p.manyToOne(Volume).nullable().deleteRule('cascade'),
    fee: p.integer().nullable()
  }
})
export class LegacyReadingListVolume
  extends LegacyReadingListVolumeSchema.class {}
LegacyReadingListVolumeSchema.setClass(LegacyReadingListVolume)

export const libraryEntities = [
  Library,
  ReadingList,
  Volume,
  ReadingListVolume,
  LegacyReadingListVolume
]

// The library of the tests with `populate`.
export const loadLibrary = (em: EntityManager, populate: string[]) =>
  em.findOneOrFail(Library, 1, { populate: populate as never[] })
