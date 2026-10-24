import { serializeData } from './schema/data.js'
import { walkData } from './schema/walk.js'
import type { Services } from './services.ts'
import type { Data, Schema } from './types.ts'

// Copies refer to the related records outside of them by the labels of their
// options, so load the options of all relations first:
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
    shouldSkipIrrelevant: true,
    visit: entry => {
      const { relation } = entry.node
      if (relation?.hasOptions) {
        loads.push(
          services
            .dataContext!.model.fields.getOptionsResolver({
              ...entry,
              schema: relation.schema
            })
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
