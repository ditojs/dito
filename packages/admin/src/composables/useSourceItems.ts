import SchemaContext from '../SchemaContext.js'
import { appendDataPath } from '../utils/data.js'
import { getItemDisplayValue } from '../utils/schema/data.js'
import { getLabel, type Label } from '../utils/schema/value.js'
import { getItemFormSchema } from '../utils/schema/lookup.js'
import { getItemIdOrIndex, getItemLabel } from '../utils/schema/item.js'
import { getText } from '../utils/html.js'
import type { Context } from '../utils/schema/types.ts'
import type { Data, Schema } from '../utils/types.ts'

export interface SourceItemsOptions {
  services: object
  getContext: () => Context
  getSchema: () => Schema
  getDataPath: () => string
  isTransient?: () => boolean
}

// The ids, data paths and labels of the items of the component's own source
// schema, or of a source in its data, like the children of tree items.
export function useSourceItems({
  services,
  getContext,
  getSchema,
  getDataPath,
  isTransient = () => false
}: SourceItemsOptions) {
  const getItemDataPath = (sourceSchema: Schema, index?: number | null) => {
    let dataPath = getDataPath()
    if (sourceSchema !== getSchema()) {
      dataPath = appendDataPath(dataPath, sourceSchema.name)
    }
    return index != null ? appendDataPath(dataPath, index) : dataPath
  }

  return {
    getItemDataPath,

    getItemId(sourceSchema: Schema, item: Data, index: number | null = null) {
      return getItemIdOrIndex(sourceSchema, item, {
        index,
        isTransient: isTransient()
      })
    },

    // Item labels are HTML:
    getItemLabel(
      sourceSchema: Schema,
      item: Data | null,
      {
        index = null,
        extended = false,
        asObject = false
      }: { index?: number | null; extended?: boolean; asObject?: boolean } = {}
    ) {
      let formLabel: Label | undefined
      const getFormLabel = () => {
        if (formLabel === undefined) {
          const context = getContext()
          const form = getItemFormSchema(sourceSchema, item, context)
          formLabel = form ? getLabel(form, context) : ''
        }
        return formLabel
      }

      return getItemLabel(sourceSchema, item, {
        index,
        extended,
        asObject,
        getFormLabel,
        getDisplayValue: (key: string) =>
          getItemDisplayValue(sourceSchema, item!, key, {
            services,
            dataPath: getItemDataPath(sourceSchema, index),
            context: getContext()
          }),
        evaluateItemLabel: () =>
          sourceSchema.itemLabel(
            new SchemaContext(services, {
              schema: sourceSchema,
              name: sourceSchema.name,
              nested: false,
              data: item,
              value: item,
              // Item labels describe the item, also in its form, where no list
              // shows, so they don't depend on the list's query, nor on the
              // label that they produce:
              sourceQuery: null,
              itemLabel: null,

              get dataPath() {
                return getItemDataPath(sourceSchema, index)
              },

              get formLabel() {
                return getText(getFormLabel())
              }
            })
          )
      })
    }
  }
}
