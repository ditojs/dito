import {
  computed,
  inject,
  onUnmounted,
  provide,
  reactive,
  toRef,
  watch
} from 'vue'
import SchemaContext from '../SchemaContext.js'
import { ItemStores } from '../utils/ItemStores.js'
import { appendDataPath } from '../utils/data.js'
import { confirmAndRemove } from '../utils/dialogs.js'
import {
  adminContextKey,
  resourceContextKey,
  routeContextKey,
  schemaEventsKey,
  sourceContextKey
} from '../utils/keys.ts'
import { getResource, getMemberResource } from '../utils/resource.js'
import { waitUntilDataModelSettled } from '../utils/services.ts'
import { initializeData } from '../utils/schema/data.js'
import { getButtonSchemas, hasFormSchema } from '../utils/schema/lookup.js'
import { isInlined, isListSource } from '../utils/schema/structure.js'
import { useField, type FieldProps } from './useField.ts'
import { useResource } from './useResource.ts'
import { useListQuery } from './useListQuery.ts'
import { useSourceData } from './useSourceData.ts'
import { useSourceItems } from './useSourceItems.ts'
import type { SubmitButton } from '../utils/ResourceContext.ts'
import type { SourceContext } from '../utils/SourceContext.ts'
import type { Data, Schema } from '../utils/types.ts'

const unauthorizedError = `You don't have permission to load this data.`

// A list, object or tree: its items, query, actions and resource, and the
// `sourceContext` and `resourceContext` that it provides to its components.
export function useSource(
  props: FieldProps,
  {
    // Show the errors of the filters that the server rejected, and return
    // whether they're shown:
    onFilterErrors
  }: { onFilterErrors?: (errors: Record<string, any>) => boolean } = {}
) {
  const adminContext = inject(adminContextKey)!
  const routeContext = inject(routeContextKey, null)
  // Sources emit their `load` event through the schema that renders them:
  const schemaEvents = inject(schemaEventsKey)!
  // The node holds the state of the routes of the source, e.g. whether it
  // links to a view or loads its data through its resource, or is part of the
  // data around it:
  const requests = useResource({
    adminContext,
    parentResourceContext: inject(resourceContextKey, null),
    parentRouteContext: routeContext,
    getSchema: () => props.schema,
    isTransient: () => node.value.isTransient
  })
  const { resourceContext, isTransient, providesData } = requests
  props.field.addMembers({
    get sourceContext() {
      return sourceContext
    },

    ...(resourceContext && { resourceContext })
  })
  const {
    value,
    context,
    services,
    createContext,
    labelText,
    disabled,
    readonly,
    onChange,
    getSchemaValue,
    node,
    componentPath
  } = useField(props)
  const linksToView = computed(() => node.value.linksToView)
  const getModel = () => services.dataContext!.model
  const getBoolean = (key: string) =>
    getSchemaValue(key, { type: Boolean, default: false })

  const hasInlinedItems = () => isInlined(props.schema)
  const isList = () => isListSource(props.schema)
  const paginate = computed(() => getSchemaValue('paginate', { type: Number }))
  // Sources are hidden while the forms of their items show, e.g. the lists of
  // views, but stay mounted to claim the routes of the forms:
  const isShown = () => !routeContext || routeContext.isActive

  const {
    listQuery,
    columns,
    scopes,
    paginationRange,
    getRequestQuery
  } = useListQuery(props, {
    getPaginate: () => paginate.value,
    // Lists outside of routes, e.g. in dialogs, keep the query to themselves:
    isInRoute: () => !!routeContext,
    isRouted: () => providesData.value && !!routeContext && isShown(),
    onChange: () => loadData()
  })

  const total = computed({
    get: () => props.store.total,
    set: total => (props.store.total = total)
  })

  const sourceData = useSourceData(props, {
    services,
    value,
    total,
    getPageOffset: () => paginationRange.value?.[0]
  })
  const { isObjectSource, listData, objectData, listEntry } = sourceData

  // While navigating to a changed query, the list loads once the route did.
  // Only load here if the navigation failed or was superseded:
  let isUnmounted = false
  onUnmounted(() => {
    isUnmounted = true
  })
  const requestData = (): Promise<void> | undefined => {
    const navigated = listQuery.whenNavigated()
    return navigated
      ? navigated.then((hasNavigated: boolean) => {
          if (!hasNavigated && !isUnmounted) {
            return requestData()
          }
        })
      : requests.loadData({
          query: getRequestQuery(),
          async onLoad(data) {
            if (routeContext?.isForm) {
              getModel().errors.remove(props.dataPath, unauthorizedError)
            }
            sourceData.setData(data)
            await schemaEvents.emitEvent('load')
          },
          onError({ data, status }) {
            if (
              data?.type === 'FilterValidation' &&
              onFilterErrors?.(data.errors)
            ) {
              return true
            } else if (status === 401 && routeContext?.isForm) {
              // Sources in forms show that the user may not access their
              // resource:
              getModel().errors.add(props.dataPath, unauthorizedError)
              return true
            }
            return false
          }
        })
  }
  // Sources in data that isn't stored yet, e.g. of forms that create their
  // item, have nothing to load. Hidden sources load once they're shown:
  let isLoadDeferred = false
  const loadData = () => {
    if (!isTransient.value) {
      isLoadDeferred = !isShown()
      if (!isLoadDeferred) {
        return requestData()
      }
    }
  }
  watch(isShown, isShown => {
    if (isShown && isLoadDeferred) {
      loadData()
    }
  })

  const { getItemId, getItemLabel, getItemDataPath } = useSourceItems({
    services,
    getContext: () => context,
    getSchema: () => props.schema,
    getDataPath: () => props.dataPath,
    isTransient: () => isTransient.value
  })

  // The actions on the items, and the paths of their forms:
  const itemStores = ItemStores.getFromStore(props.store)
  // Object sources only have an item to edit or delete once they're set:
  const hasItems = () => isList() || !!objectData.value

  // Lists linked to views create their items in the form of the view:
  const creatable = computed(
    () => (
      getBoolean('creatable') &&
      (hasFormSchema(props.schema) || linksToView.value) &&
      (isList() || !objectData.value)
    )
  )
  const editable = computed(
    () => getBoolean('editable') && !hasInlinedItems() && hasItems()
  )
  const deletable = computed(() => getBoolean('deletable') && hasItems())
  const draggable = computed(
    () => isList() && getBoolean('draggable')
  )
  const collapsible = computed(
    () => getBoolean('collapsible') && hasInlinedItems()
  )
  const collapsed = computed(
    () => getBoolean('collapsed') && collapsible.value
  )

  // The form of the view addresses the items by their ids:
  const getViewItemPath = (key: string | undefined) =>
    key != null
      ? (adminContext.routeTree?.getViewItemPath(props.schema.view, key) ??
        null)
      : null

  const getItemStore = (item: Data, index: number) =>
    itemStores.getStore(props.schema, item, index)

  // Insert `data` as an item with the form `schema` at `index`, or else at the
  // end, and initialize it in its place in the data:
  const insertItem = (schema: Schema, data: Data, index?: number | null) => {
    let item: Data
    let dataPath = props.dataPath
    if (isObjectSource.value) {
      objectData.value = data
      item = objectData.value
    } else {
      index ??= listData.value.length
      if (sourceData.hasData.value) {
        item = sourceData.insertItem(index, data)
      } else {
        // Lists that are `null` have no array to insert into yet:
        listData.value = [data]
        item = listData.value[0]
      }
      dataPath = appendDataPath(dataPath, index)
    }
    initializeData(schema, item, services, {
      dataPath,
      rootData: getModel().rootData
    })
    return item
  }

  // Create an item with the form `schema`, of `type` if the source has several
  // forms, and insert it at `index`, or else at the end:
  const createItem = (
    schema: Schema,
    type?: string | null,
    index?: number | null
  ) => {
    const item = insertItem(schema, type ? { type } : {}, index)
    if (collapsible.value) {
      // Open the new item, which its inlined schema reads from its store:
      const store = isObjectSource.value
        ? props.store
        : getItemStore(item, listData.value.indexOf(item))
      store.opened = true
    }
    onChange()
    return item
  }

  const deleteItem = async (item: Data | null, index: number | null = null) => {
    if (item) {
      const isTransientItem = isTransient.value
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
          itemStores.removeStore(props.schema, item, currentIndex)
          // Sources with a resource delete the item through it, not as edit:
          if (currentIndex === null) {
            if (isTransientItem) {
              objectData.value = null
            } else {
              const { data, schema, dataPath } = props
              getModel().setLoaded(
                { schema, data, name: schema.name, dataPath },
                null
              )
            }
          } else if (isTransientItem) {
            getModel().remove(listEntry.value, currentIndex)
          } else {
            getModel().removeDeleted(listEntry.value, currentIndex)
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
            getItemId(props.schema, item, currentIndex),
            requests.getResource({ method })
          )
        )
        let isDeleted = false
        if (memberResource) {
          await requests.request(
            { method, resource: memberResource },
            err => {
              if (!err) {
                removeIfPresent()
                isDeleted = true
              }
              loadData()
            }
          )
        }
        return isDeleted
      }

      await confirmAndRemove(services, {
        label: getItemLabel(props.schema, item, { index, extended: true }),
        isTransient: isTransientItem,
        remove: isTransientItem ? removeIfPresent : deleteThroughResource
      })
    }
  }

  // Submit the data of the source to the resource of the button:
  const submitData = async (button: SubmitButton) => {
    // Wait for the data that's still loading, e.g. uploads, like forms do:
    await waitUntilDataModelSettled(services)
    const model = getModel()
    const buttonResource = button.schema.resource
    const submitted = getResource(buttonResource, {
      parent: requests.getResource({
        method: buttonResource?.method,
        child: buttonResource
      })
    })
    if (submitted) {
      const { method } = submitted
      const isSuccessful = await requests.submitResource(
        button,
        submitted,
        method,
        requests.getPayloadData(button, method),
        {
          showValidationErrors: errors =>
            services.dataContext!.showValidationErrors(errors, props.dataPath)
        }
      )
      if (isSuccessful) {
        // Saving the source's own changes clears their errors, as in forms:
        model.markClean({ dataPath: props.dataPath })
        model.errors.clear(props.dataPath)
      }
      return isSuccessful
    }
    return false
  }

  const render = computed(() =>
    getSchemaValue('render', { type: Function, default: null })
  )

  const sourceContext: SourceContext = reactive({
    schema: toRef(props, 'schema'),
    listQuery,
    dataPath: toRef(props, 'dataPath'),
    componentPath,
    store: toRef(props, 'store'),
    isDisabled: disabled,
    verbs: requests.verbs,
    createItem,

    // Each item reads its own label, so that edits only update theirs:
    getSourceItemLabel(item: any, index: number | null = null) {
      const { schema } = props
      if (hasInlinedItems()) {
        // Inlined items show the label in their schema, but only in lists and
        // collapsible objects:
        return isList() || collapsible.value
          ? getItemLabel(schema, item, { index, asObject: true })
          : null
      } else {
        return render.value
          ? render.value(
              new SchemaContext(services, {
                schema,
                name: schema.name,
                nested: false,
                data: item,
                value: item,
                dataPath: getItemDataPath(schema, index)
              })
            )
          : getItemLabel(schema, item, { index })
      }
    },

    reload: loadData,

    // Leaving the route waits for pending submits:
    submit(button: SubmitButton) {
      return getModel().trackPendingSubmit(submitData(button))
    },

    createPath: computed(() =>
      creatable.value
        ? linksToView.value
          ? getViewItemPath('create')
          : node.value.formPath && `${node.value.formPath}/create`
        : null
    ),

    // Object sources are their own item:
    objectPath: computed(() =>
      linksToView.value
        ? objectData.value &&
          getViewItemPath(getItemId(props.schema, objectData.value))
        : node.value.formPath
    ),

    getItemPath(index: number) {
      return linksToView.value
        ? getViewItemPath(getItemId(props.schema, listData.value[index], index))
        : node.value.formPath && node.value.getItemRoutePath(index)
    }
  })
  // The node keeps the source while it's mounted, for the forms of its items:
  watch(
    node,
    (node, oldNode) => {
      if (oldNode?.sourceContext === sourceContext) {
        oldNode.sourceContext = null
      }
      node.sourceContext = sourceContext
    },
    { immediate: true }
  )
  onUnmounted(() => {
    if (node.value.sourceContext === sourceContext) {
      node.value.sourceContext = null
    }
  })

  provide(sourceContextKey, sourceContext)
  if (resourceContext) {
    provide(resourceContextKey, resourceContext)
  }
  const { sources } = services.dataContext!
  sources.add(sourceContext)
  onUnmounted(() => sources.delete(sourceContext))

  if (providesData.value) {
    loadData()
  }

  return {
    value,
    context,
    createContext,
    componentPath,
    labelText,
    disabled,
    readonly,
    onChange,
    services,
    sourceContext,
    listQuery,
    columns,
    scopes,
    total,
    paginate,
    isLoading: requests.isLoading,
    isListSource: sourceData.isListSource,
    isObjectSource,
    listData,
    objectData,
    listEntry,
    getItemDataPath,
    creatable,
    editable,
    deletable,
    draggable,
    collapsible,
    collapsed,
    getItemStore,
    insertItem,
    deleteItem,
    // Lists with routed forms don't render where the recursion of forms that
    // contain themselves stops. Sources without data and resource render, e.g.
    // for `computeValue()`:
    isReady: computed(
      () => (
        (hasInlinedItems() || !node.value.isBeyondMaxDepth) &&
        (sourceData.hasData.value || !providesData.value)
      )
    ),
    isInlined: computed(hasInlinedItems),
    buttonSchemas: computed(() => getButtonSchemas(props.schema.buttons))
  }
}
