import type { z } from 'zod'
import {
  EntitySchema,
  JsonType,
  UnderscoreNamingStrategy,
  type Platform,
  type TransformContext
} from '@mikro-orm/core'
import { getEntities } from './metadata.ts'

// A write runs the `schema` of a column's custom type, a Zod schema, on the
// value, see `write.ts`. The schema only validates, and the value is
// written as sent. `defineJsonType()` declares the type of a JSON column:
//
//   specs: p.type(defineJsonType({ schema: specsSchema })).nullable()
//
// MikroORM deep-copies the metadata with its custom types, which breaks
// schemas such as Zod's. So the schema comes from a getter, which the copy
// leaves out.
//
// `assets` says where a JSON column holds files, for `getAssetPaths()`: `path`
// is the data path inside the value, with `*` and `**` wildcards, `storage`
// the storage of the files, and `maxSize` the size limit of their uploads,
// imports and copies, in bytes or as a string with a unit, such as `'500mb'`.
// A column of files needs no schema:
//
//   images: p.type(
//     defineJsonType({ assets: [{ path: '', storage: 'public' }] })
//   )
//   items: p.type(
//     defineJsonType({
//       schema: itemsSchema,
//       assets: [{ path: '**/file', storage: 'public' }]
//     })
//   )

export interface JsonTypeAsset {
  path: string
  storage: string
  maxSize?: number | string
}

export interface JsonTypeOptions<
  S extends z.ZodType | undefined = z.ZodType | undefined
> {
  schema?: S
  assets?: JsonTypeAsset[]
}

// `p.type()` infers the column type from these, `JsonType` has `unknown`.
export interface SchemaJsonType<T> {
  convertToJSValue(
    value: unknown,
    platform: Platform,
    context?: TransformContext
  ): T
  convertToDatabaseValue(
    value: T,
    platform: Platform,
    context?: TransformContext
  ): string | null
  toJSON(value: T, platform: Platform): T | string | null
  fromJSON?(value: unknown, platform: Platform): T
}

export class SchemaJsonType<T = any> extends JsonType {
  // The copy keeps functions as they are.
  readonly getSchema: () => z.ZodType | undefined
  readonly assets: JsonTypeAsset[]

  constructor({ schema, assets = [] }: JsonTypeOptions) {
    super()
    this.getSchema = () => schema
    this.assets = assets
  }

  get schema() {
    return this.getSchema()
  }
}

export function defineJsonType<S extends z.ZodType | undefined = undefined>(
  options: JsonTypeOptions<S>
) {
  return new SchemaJsonType<S extends z.ZodType ? z.output<S> : any>(options)
}

// The asset paths of `@ditojs/storage`, from the `assets` of the JSON columns
// of `entities`, classes or a module of them. It reads the definitions, so it
// needs no ORM. Names follow MikroORM's default naming strategy.
export function getAssetPaths(entities: object) {
  const naming = new UnderscoreNamingStrategy()
  return getEntities(entities).flatMap(entity => {
    const { meta } =
      entity instanceof EntitySchema
        ? entity
        : EntitySchema.REGISTRY.get(entity)!
    const table = meta.tableName ?? naming.classToTableName(meta.className)
    return Object.entries(meta.properties).flatMap(([name, prop]) => {
      const type = prop.customType ?? prop.type
      if (!(type instanceof SchemaJsonType)) return []
      const column = prop.fieldNames?.[0] ?? naming.propertyToColumnName(name)
      return type.assets.map(asset => ({ table, column, ...asset }))
    })
  })
}
