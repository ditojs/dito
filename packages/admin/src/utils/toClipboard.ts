import { serializeData } from './schema/data.js'
import { walkData } from './schema/walk.js'
import { getOptionsDataSchema } from './schema/types.ts'
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
    visit: entry => {
      for (const { schema } of entry.node.fields) {
        if (schema.relate && getOptionsDataSchema(schema)) {
          loads.push(
            services
              .dataContext!.model.getOptionsResolver({ ...entry, schema })
              .waitForValue()
          )
        }
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
