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

export class SchemaJson<
  S extends z.ZodType = z.ZodType
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

export function schemaJson<S extends z.ZodType>(schema: S) {
  return p.json<z.output<S>>().type(new SchemaJson(schema))
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
