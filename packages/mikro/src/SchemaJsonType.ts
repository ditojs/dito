import type { z } from 'zod'
import { isArray, isObject } from '@ditojs/utils'
import {
  EntitySchema,
  JsonType,
  UnderscoreNamingStrategy,
  type Platform,
  type TransformContext
} from '@mikro-orm/core'
import { getEntities } from './metadata.ts'

// The custom type of JSON columns, with the schema that writes check and the
// files that the columns hold.

export interface JsonTypeAsset {
  dataPath: string
  storage: string
  maxSize?: number | string
}

export interface DefineJsonTypeOptions<
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
  // MikroORM deep-copies the metadata with its custom types, which breaks
  // schemas such as Zod's, but keeps functions as they are and leaves getters
  // out:
  readonly getSchema: () => z.ZodType | undefined
  readonly assets: JsonTypeAsset[]

  constructor({ schema, assets = [] }: DefineJsonTypeOptions) {
    super()
    this.getSchema = () => schema
    this.assets = assets
  }

  get schema() {
    return this.getSchema()
  }
}

export function defineJsonType<S extends z.ZodType | undefined = undefined>(
  options: DefineJsonTypeOptions<S>
) {
  return new SchemaJsonType<S extends z.ZodType ? z.output<S> : any>(options)
}

// The outputs of the schemas of writes. `SchemaDefaults` skips them, since a
// second parse can change a value.
const parsedValues = new WeakSet<object>()

const isContainer = (value: unknown): value is object => (
  isObject(value) || isArray(value)
)

export function setParsed(value: unknown) {
  if (isContainer(value)) parsedValues.add(value)
}

// Only objects and arrays can hold defaults to fill.
export const needsDefaults = (value: unknown) => (
  isContainer(value) && !parsedValues.has(value)
)

// Read the definitions, so that no ORM is needed, and name tables and columns
// as MikroORM's default naming strategy does:
export function getAssetFields(entities: object) {
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
      return type.assets.map(asset => ({
        entity: meta.class,
        table,
        column,
        ...asset
      }))
    })
  })
}
