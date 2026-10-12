import { computed, type Ref } from 'vue'
import { ItemStores } from '../utils/ItemStores.js'
import { appendDataPath } from '../utils/data.js'
import { confirmAndRemove } from '../utils/dialogs.js'
import { getMemberResource } from '../utils/resource.js'
import { initializeData, getItemUid } from '../utils/schema/data.js'
import { hasFormSchema } from '../utils/schema/lookup.js'
import type { Services } from '../utils/services.ts'
import type { Data, Schema } from '../utils/types.ts'
import type { ResourceRequests } from './useResource.ts'
import type { SourceData } from './useSourceData.ts'
import type { useItemLabel } from './useItemLabel.ts'

export interface SourceActionsProps {
  readonly schema: Schema
  readonly data: Data
  readonly dataPath: string
  readonly store: Record<string, any>
}

// What the user can do with the items of a source, and the paths of the forms
// that create and edit them.
export function useSourceActions(
  props: SourceActionsProps,
  {
    services,
    sourceData,
    resource,
    itemLabel,
    isInlined,
    linksToView,
    getSchemaValue,
    onChange
  }: {
    services: Services
    sourceData: SourceData
    resource: ResourceRequests
    itemLabel: ReturnType<typeof useItemLabel>
    isInlined: () => boolean
    linksToView: Readonly<Ref<boolean>>
    getSchemaValue: (key: string, options: object) => any
    onChange: () => void
  }
) {
  const { admin } = services
  const { isListSource, isObjectSource, listData, objectData } = sourceData
  const itemStores = ItemStores.getFromStore(props.store)
  const getModel = () => services.container!.model

  const getBoolean = (key: string) =>
    getSchemaValue(key, { type: Boolean, default: false })

  // Object sources only have an item to edit or delete once they're set:
  const hasItems = () => isListSource.value || !!objectData.value

  // Lists linked to views create their items in the form of the view:
  const creatable = computed(
    () => (
      getBoolean('creatable') &&
      (hasFormSchema(props.schema) || linksToView.value) &&
      (isListSource.value || !objectData.value)
    )
  )
  const editable = computed(
    () => getBoolean('editable') && !isInlined() && hasItems()
  )
  const deletable = computed(() => getBoolean('deletable') && hasItems())
  const draggable = computed(
    () => isListSource.value && getBoolean('draggable')
  )
  const collapsible = computed(() => getBoolean('collapsible') && isInlined())
  const collapsed = computed(
    () => getBoolean('collapsed') && collapsible.value
  )

  // Lists linked to views edit their items in the form of the view, which
  // addresses them by their ids:
  const getViewItemPath = (key: string | undefined) => {
    const route = (
      key != null &&
      admin.routeTree?.getViewItemRoute(props.schema.view, key)
    )
    return route ? admin.router.resolve(route).path : null
  }

  const getItemStore = (item: Data) =>
    itemStores.getStore(getItemUid(props.schema, item))

  return {
    creatable,
    editable,
    deletable,
    draggable,
    collapsible,
    collapsed,
    getItemStore,

    createPath: computed(() =>
      creatable.value
        ? linksToView.value
          ? getViewItemPath('create')
          : (services.route?.getCreatePath(props.dataPath) ?? null)
        : null
    ),

    // The path of the form of object sources, which are their own item:
    objectPath: computed(() =>
      linksToView.value
        ? objectData.value &&
          getViewItemPath(itemLabel.getItemId(props.schema, objectData.value))
        : (services.route?.getFormPath(props.dataPath) ?? null)
    ),

    getItemPath(index: number) {
      return linksToView.value
        ? getViewItemPath(
            itemLabel.getItemId(props.schema, listData.value[index], index)
          )
        : (services.route?.getFormPath(appendDataPath(props.dataPath, index)) ??
          null)
    },

    // Create an item with the form `schema`, of `type` if the source has
    // several forms, and insert it at `index`, or else at the end:
    createItem(schema: Schema, type?: string | null, index?: number | null) {
      const item = initializeData(schema, type ? { type } : {}, services)
      if (isObjectSource.value) {
        objectData.value = item
      } else if (sourceData.hasData.value) {
        const listEntry = sourceData.listEntry.value
        getModel().insert(listEntry, index ?? listEntry.list.length, item)
      } else {
        // Lists that are `null` have no array to insert into yet:
        listData.value = [item]
      }
      if (collapsible.value) {
        // Open the new item, which its inlined schema reads from its store:
        const store = isObjectSource.value ? props.store : getItemStore(item)
        store.opened = true
      }
      onChange()
      return item
    },

    async deleteItem(item: Data | null, index: number | null = null) {
      if (item) {
        const isTransient = resource.isTransient.value
        // Look up the item by identity whenever it's removed, as the data may
        // have changed while the dialog was open or the request was pending.
        // Object sources have no index:
        const getCurrentIndex = () =>
          isObjectSource.value
            ? objectData.value === item
              ? null
              : -1
            : listData.value.indexOf(item)

        const removeIfPresent = () => {
          const currentIndex = getCurrentIndex()
          const isPresent = currentIndex !== -1
          if (isPresent) {
            itemStores.removeStore(getItemUid(props.schema, item))
            // Sources with a resource delete the item through it, not as an
            // edit:
            if (currentIndex === null) {
              if (isTransient) {
                objectData.value = null
              } else {
                props.data[props.schema.name] = null
              }
            } else {
              getModel().remove(sourceData.listEntry.value, currentIndex)
              if (!isTransient) {
                getModel().markClean({ dataPath: props.dataPath })
              }
            }
            onChange()
          }
          return isPresent
        }

        const deleteThroughResource = async () => {
          const currentIndex = getCurrentIndex()
          const method = 'delete'
          const memberResource = (
            currentIndex !== -1 &&
            getMemberResource(
              itemLabel.getItemId(props.schema, item, currentIndex),
              resource.getResource({ method })
            )
          )
          let isDeleted = false
          if (memberResource) {
            await resource.handleRequest(
              { method, resource: memberResource },
              err => {
                if (!err) {
                  removeIfPresent()
                  isDeleted = true
                }
                resource.reloadData()
              }
            )
          }
          return isDeleted
        }

        await confirmAndRemove(services, {
          label: itemLabel.getItemLabel(props.schema, item, {
            index,
            extended: true
          }),
          isTransient,
          remove: isTransient ? removeIfPresent : deleteThroughResource
        })
      }
    }
  }
}
