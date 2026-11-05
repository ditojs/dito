import type { z } from 'zod'
import type { ValidationIssue } from '@ditojs/server'

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
