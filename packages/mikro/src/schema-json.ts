import type { z } from 'zod'
import type { ValidationIssue } from '@ditojs/server'
import { JsonType, p } from '@mikro-orm/core'

// A write runs the `schema` of a column's custom type, a Zod schema, on the
// value, see `write.ts`. The schema only validates, and the value is
// written as sent. `schemaJson()` declares a JSON column with a schema:
//
//   specs: schemaJson(z.object({ weight: z.number() })).nullable()
//
// MikroORM deep-copies the metadata with its custom types, which breaks
// schemas such as Zod's. So the schema comes from a getter, which the copy
// leaves out.
//
// `assets` says where a JSON column holds files, for `getAssetPaths()`: `path`
// is the data path inside the value, with `*` and `**` wildcards, and `storage`
// the storage of the files. `assetsJson()` declares a column without a schema:
//
//   images: assetsJson('publicAssets').nullable()
//   items: schemaJson(itemsSchema, {
//     assets: [{ path: '**/file', storage: 'publicAssets' }]
//   })

export interface ColumnAsset {
  path: string
  storage: string
}

export interface SchemaJsonOptions {
  assets?: ColumnAsset[]
}

export class SchemaJson<
  S extends z.ZodType = z.ZodType
> extends JsonType {
  // The copy keeps functions as they are.
  readonly getSchema: () => S | undefined
  readonly assets: ColumnAsset[]

  constructor(schema?: S, { assets = [] }: SchemaJsonOptions = {}) {
    super()
    this.getSchema = () => schema
    this.assets = assets
  }

  get schema() {
    return this.getSchema()
  }
}

export function schemaJson<S extends z.ZodType>(
  schema: S,
  options?: SchemaJsonOptions
) {
  return p.json<z.output<S>>().type(new SchemaJson(schema, options))
}

export function assetsJson(storage: string, path = '') {
  return p.json<any>().type(
    new SchemaJson(undefined, {
      assets: [{ path, storage }]
    })
  )
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
