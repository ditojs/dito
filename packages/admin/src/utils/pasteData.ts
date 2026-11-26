import { clone, equals } from '@ditojs/utils'
import { fromClipboard } from './fromClipboard.ts'
import { mergeData } from './mergeData.ts'
import {
  cloneItem,
  getReferenceSchema,
  getSchemaSource,
  walkData
} from './schema/walk.js'
import type { Services } from './services.ts'
import type { Data, Schema } from './types.ts'

// Paste copied data into `data` like loaded data, but keep the values of its
// fields that the pasted data lacks, e.g. hidden ones. Values that
// `computeValue()` derives are derived from the pasted ones instead:
export async function pasteData(
  schema: Schema,
  data: Data,
  clipboardData: Data,
  {
    dataPath,
    sourceSchema,
    services,
    rootData
  }: {
    dataPath: string
    // The source of the data, if it is an item:
    sourceSchema: Schema | null
    services: Services
    rootData: Data | null
  }
): Promise<void> {
  const { data: pastedData, unresolvedLabels } = await fromClipboard(
    schema,
    clipboardData,
    { dataPath, sourceSchema, services, rootData }
  )
  const item = { ...pastedData }
  // The id of items that reference a record is their content:
  let pastedReference = null
  walkData(schema, data, {
    dataPath,
    sourceSchema,
    services,
    rootData,
    shouldWalk: () => false,
    visit: (entry: any) => {
      const { node, name } = entry
      if (getReferenceSchema(entry) && pastedData[name] != null) {
        pastedReference = { [name]: pastedData[name] }
      } else if (
        name in data &&
        !(name in item) &&
        !node.getRecordedSchema(entry)?.schema.computeValue
      ) {
        item[name] = data[name]
      }
    }
  })
  // The item keeps what identifies it, also its position in its list, apart
  // from the pasted record that it references:
  if (sourceSchema) {
    Object.assign(
      item,
      cloneItem(getSchemaSource(sourceSchema), data),
      pastedReference
    )
  }
  // Only changes of the data that is saved are edits:
  const { model } = services.dataContext!
  const previousData = clone(model.serializedData.value)
  mergeData(schema, data, item, {
    services,
    shouldKeepSourcesWithResource: true
  })
  model.fields.writeComputedValues()
  if (!equals(model.serializedData.value, previousData)) {
    model.markEdited()
  }
  if (unresolvedLabels.length > 0) {
    services.adminContext.notify({
      type: 'warning',
      text: `Not found when pasting: ${unresolvedLabels.join(', ')}`
    })
  }
}
