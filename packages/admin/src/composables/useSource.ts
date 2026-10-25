import {
  computed,
  inject,
  onUnmounted,
  provide,
  reactive,
  toRef,
  unref,
  watch
} from 'vue'
import { parseDataPath } from '@ditojs/utils'
import SchemaContext from '../SchemaContext.js'
import { ItemStores } from '../utils/ItemStores.js'
import { appendDataPath, getRelativeDataPath } from '../utils/data.js'
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
import { initializeData, getItemUid } from '../utils/schema/data.js'
import {
  getButtonSchemas,
  getViewSchema,
  hasFormSchema
} from '../utils/schema/lookup.js'
import {
  isInlined,
  isListSource,
  isSingleFieldView
} from '../utils/schema/structure.js'
import {
  claimSourceRoute,
  getItemKey,
  getSourceFormRoute,
  getSourcePath,
  ViewNode,
  type SourceRoute
} from '../utils/RouteTree.ts'
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
  // The source whose items render this one, e.g. an inlined list:
  const parentSource = inject(sourceContextKey, null)
  // Sources emit their `load` event through the schema that renders them:
  const schemaEvents = inject(schemaEventsKey)!
  // Sources link to views or load their data through their resource, the
  // others are part of the data around them:
  const linksToView = computed(() => !!getViewSchema(props.schema, context))
  const requests = useResource({
    adminContext,
    parentResourceContext: inject(resourceContextKey, null),
    parentRouteContext: routeContext,
    getSchema: () => props.schema,
    isTransient: providesData => (
      (!providesData && !linksToView.value) || !!routeContext?.isTransient
    )
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
    componentPath
  } = useField(props)
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

  const getItemStore = (item: Data) =>
    itemStores.getStore(getItemUid(props.schema, item))

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
      const store = isObjectSource.value ? props.store : getItemStore(item)
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
          itemStores.removeStore(getItemUid(props.schema, item))
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

  // Forms that contain themselves stop routing their sources after `maxDepth`
  // repetitions:
  const isBeyondMaxDepth = computed(() => {
    let depth = 1
    for (let route = routeContext; route; route = route.parent) {
      if (route.claim?.schema === props.schema) depth++
    }
    return depth > (props.schema.maxDepth ?? 1)
  })

  // The path of the source within its route, after the names of the tabs,
  // sections and panels around it, e.g. `pricing/families`, or after the path
  // of the item of the inlined source whose item renders it, e.g. `books/3`:
  const routePath = computed(() => {
    const parent = unref(parentSource)
    const parentPath = parent?.routePath
      ? getRelativeDataPath(componentPath.value, parent.componentPath)
      : null
    if (parentPath) {
      const segments = parseDataPath(parentPath)
      const index = isListSource(parent!.schema) ? segments.shift()! : null
      return `${parent!.getItemRoutePath(index)}/${
        getSourcePath(props.schema, segments.join('/'), adminContext.api)
      }`
    }
    const path = routeContext
      ? getRelativeDataPath(
          componentPath.value,
          routeContext.dataContext.componentPath
        )
      : null
    if (path !== null) {
      // Single-component views route their component under their own path:
      const { node, path: basePath } = routeContext!
      return (
        node instanceof ViewNode &&
        isSingleFieldView(node.schema) &&
        path === node.schema.name
      )
        ? basePath
        : `${basePath}/${getSourcePath(props.schema, path, adminContext.api)}`
    }
    return null
  })

  // The source and where its value and routes are, for the forms of its items.
  // Inlined sources render the forms of their items themselves:
  const sourceRoute = computed<SourceRoute | null>(() =>
    (
      routePath.value &&
      !hasInlinedItems() &&
      !linksToView.value &&
      !isBeyondMaxDepth.value
    )
      ? {
          schema: props.schema,
          location: {
            data: props.data,
            key: props.schema.name,
            dataPath: props.dataPath,
            componentPath: componentPath.value
          },
          path: routePath.value,
          isTransient: isTransient.value,
          source: sourceContext
        }
      : null
  )

  // Sources link to the forms of their items, if they have one:
  const formPath = computed(() =>
    sourceRoute.value && hasFormSchema(props.schema) ? routePath.value : null
  )

  // The path of the item at `index` in the routes of the forms below it, also
  // of the items of inlined sources, or the source's own path for objects:
  const getItemRoutePath = (index: string | number | null) =>
    index !== null
      ? `${routePath.value}/${
          getItemKey(
            props.schema,
            listData.value[+index],
            index,
            isTransient.value
          )
        }`
      : routePath.value

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
          : formPath.value && `${formPath.value}/create`
        : null
    ),

    // Object sources are their own item:
    objectPath: computed(() =>
      linksToView.value
        ? objectData.value &&
          getViewItemPath(getItemId(props.schema, objectData.value))
        : formPath.value
    ),

    routePath,
    getItemRoutePath,

    getItemPath(index: number) {
      return linksToView.value
        ? getViewItemPath(getItemId(props.schema, listData.value[index], index))
        : formPath.value && getItemRoutePath(index)
    }
  })

  provide(sourceContextKey, sourceContext)
  if (resourceContext) {
    provide(resourceContextKey, resourceContext)
  }
  const { sources } = services.dataContext!
  sources.add(sourceContext)
  onUnmounted(() => sources.delete(sourceContext))

  // Routed forms display the errors of the fields that they render for their
  // items, which their component paths lead to. The source opens them, for
  // the route and for the errors alike:
  const unregisterUi = adminContext.ui.register(() => componentPath.value, {
    dataContext: services.dataContext,
    // Sources with inlined items have no route, so they don't claim:
    claimRoute: hasInlinedItems()
      ? undefined
      : path =>
          sourceRoute.value
            ? claimSourceRoute(sourceRoute.value, path, adminContext.api)
            : null,
    getFormRoute: path =>
      sourceRoute.value
        ? getSourceFormRoute(sourceRoute.value, path, adminContext.api)
        : null
  })
  onUnmounted(unregisterUi)

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
        (hasInlinedItems() || !isBeyondMaxDepth.value) &&
        (sourceData.hasData.value || !providesData.value)
      )
    ),
    isInlined: computed(hasInlinedItems),
    buttonSchemas: computed(() => getButtonSchemas(props.schema.buttons))
  }
}
