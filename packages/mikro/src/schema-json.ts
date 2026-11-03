import type { StandardSchemaV1 } from '@standard-schema/spec'
import { JsonType, p } from '@mikro-orm/core'

// A write runs the `schema` of a column's custom type, a Standard Schema, on
// the value, see `write.ts`. The schema only validates, and the value is
// written as sent. `schemaJson()` declares a JSON column with a schema:
//
//   specs: schemaJson(z.object({ weight: z.number() })).nullable()
//
// MikroORM deep-copies the metadata with its custom types, which breaks
// schemas such as Zod's. So the schema comes from a getter, which the copy
// leaves out.

export class SchemaJson<
  S extends StandardSchemaV1 = StandardSchemaV1
> extends JsonType {
  // The copy keeps functions as they are.
  readonly getSchema: () => S

  constructor(schema: S) {
    super()
    this.getSchema = () => schema
  }

  get schema() {
    return this.getSchema()
  }
}

export function schemaJson<S extends StandardSchemaV1>(schema: S) {
  return p
    .json<StandardSchemaV1.InferOutput<S>>()
    .type(new SchemaJson(schema))
}

// The result for a schema that throws, without the error's message, which may
// hold internals.
const failedSchema = {
  issues: [{ code: 'custom', message: 'Invalid input' }]
}

// Runs a Standard Schema, which may throw or return a promise.
export function runSchema(
  schema: StandardSchemaV1,
  value: unknown
): Promise<StandardSchemaV1.Result<unknown>> {
  return Promise.try(() => schema['~standard'].validate(value)).catch(
    () => failedSchema
  )
}
