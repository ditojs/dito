import { serializeData } from './schema/data.js'
import { walkData, getReferenceSchema } from './schema/walk.js'
import type { Services } from './services.ts'
import type { Data, Schema } from './types.ts'

// Copies refer to the records outside of them by the labels of their options,
// so load the options of all relations and references first:
export async function toClipboard(
  schema: Schema,
  sourceSchema: Schema | null,
  data: Data,
  dataPath: string,
  { services, rootData }: { services: Services; rootData: Data | null }
): Promise<Data> {
  const loads: Promise<any>[] = []
  walkData(schema, data, {
    dataPath,
    services,
    rootData,
    sourceSchema,
    shouldSkipIrrelevant: true,
    visit: entry => {
      const { relation } = entry.node
      const schema = relation?.hasOptions
        ? relation.schema
        : getReferenceSchema(entry)
      if (schema) {
        loads.push(
          services
            .dataContext!.model.fields.getOptionsResolver({ ...entry, schema })
            .waitForValue()
        )
      }
    }
  })
  await Promise.all(loads)
  return serializeData(schema, sourceSchema, data, dataPath, {
    services,
    rootData,
    target: 'clipboard'
  })
}
