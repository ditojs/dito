import type { z } from 'zod'
import type { ValidationIssue } from '@ditojs/server'
import {
  JsonType,
  type Platform,
  type TransformContext
} from '@mikro-orm/core'

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
// is the data path inside the value, with `*` and `**` wildcards, and `storage`
// the storage of the files. A column of files needs no schema:
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

// The result for a schema that throws, without the error's message, which may
// hold internals.
const failedSchema = {
  issues: [{ code: 'custom', message: 'Invalid input' }]
}

// Runs a schema, whose custom checks may throw or reject.
export async function runSchema(
  schema: z.ZodType,
  value: unknown
): Promise<{ value?: unknown; issues?: readonly ValidationIssue[] }> {
  try {
    const { data, error } = await schema.safeParseAsync(value)
    return error ? { issues: error.issues } : { value: data }
  } catch {
    return failedSchema
  }
}
