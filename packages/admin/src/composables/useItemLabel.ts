import { labelize } from '@ditojs/utils'
import DitoContext from '../DitoContext.js'
import { appendDataPath } from '../utils/data.js'
import { getItemUid, getSchemaValue } from '../utils/schema/data.js'
import { getItemFormSchema } from '../utils/schema/lookup.js'
import { getItemIdOrIndex, getItemLabel } from '../utils/schema/item.js'
import type { Context } from '../utils/schema/types.ts'
import type { Data, Schema } from '../utils/types.ts'

export interface ItemLabelOptions {
  services: object
  getContext: () => Context
  getSchema: () => Schema
  getDataPath: () => string
  isTransient?: () => boolean
}

// The ids, data paths and labels of the items of the component's own source
// schema, or of a source in its data, like the children of tree items.
export function useItemLabel({
  services,
  getContext,
  getSchema,
  getDataPath,
  isTransient = () => false
}: ItemLabelOptions) {
  const getItemDataPath = (sourceSchema: Schema, index?: number | null) => {
    let dataPath = getDataPath()
    if (sourceSchema !== getSchema()) {
      dataPath = appendDataPath(dataPath, sourceSchema.name)
    }
    return index != null ? appendDataPath(dataPath, index) : dataPath
  }

  return {
    getItemUid,
    getItemFormSchema,
    getItemDataPath,

    getItemId(sourceSchema: Schema, item: Data, index: number | null = null) {
      return getItemIdOrIndex(sourceSchema, item, {
        index,
        isTransient: isTransient()
      })
    },

    // Labels are HTML:
    getItemLabel(
      sourceSchema: Schema,
      item: Data | null,
      {
        index = null,
        extended = false,
        asObject = false
      }: { index?: number | null; extended?: boolean; asObject?: boolean } = {}
    ) {
      let formLabel: string | undefined
      const getFormLabel = () => {
        if (formLabel === undefined) {
          const context = getContext()
          const form = getItemFormSchema(sourceSchema, item, context)
          formLabel = form
            ? getSchemaValue('label', {
                schema: form,
                context,
                type: [String, Object]
              }) || labelize(form.name)
            : ''
        }
        return formLabel
      }

      return getItemLabel(sourceSchema, item, {
        index,
        extended,
        asObject,
        getFormLabel,
        evaluateItemLabel: () =>
          sourceSchema.itemLabel(
            new DitoContext(services, {
              nested: false,
              data: item,
              value: item,
              index,

              get dataPath() {
                return getItemDataPath(sourceSchema, index)
              },

              get formLabel() {
                return getFormLabel()
              }
            })
          )
      })
    }
  }
}
