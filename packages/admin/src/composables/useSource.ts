import {
  computed,
  inject,
  markRaw,
  onUnmounted,
  provide,
  reactive,
  toRef,
  watch
} from 'vue'
import { isString } from '@ditojs/utils'
import SchemaContext from '../SchemaContext.js'
import { ItemStores } from '../utils/ItemStores.js'
import { ListQuery } from '../utils/ListQuery.js'
import { appendDataPath, getRelativeDataPath } from '../utils/data.js'
import { confirmAndRemove } from '../utils/dialogs.js'
import {
  getResource,
  getMemberResource,
  hasResource
} from '../utils/resource.js'
import {
  ResourceContext,
  type SubmitButton
} from '../utils/ResourceContext.ts'
import type { SourceContext } from '../utils/SourceContext.ts'
import { waitUntilDataModelSettled } from '../utils/services.ts'
import type { FormNode, ViewNode } from '../utils/RouteTree.ts'
import { initializeData, getItemUid } from '../utils/schema/data.js'
import {
  getButtonSchemas,
  getNamedSchemas,
  getViewSchema,
  hasFormSchema
} from '../utils/schema/lookup.js'
import { isInlined, isListSource } from '../utils/schema/structure.js'
import type { Data, Schema } from '../utils/types.ts'
import { useField, type FieldProps } from './useField.ts'
import { useServices } from './useSchemaContext.ts'
import { useResource } from './useResource.ts'
import { useSourceData } from './useSourceData.ts'
import { useItemLabel } from './useItemLabel.ts'
import type { SchemaEventsEmitter } from './useSchemaEvents.ts'

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
  // Sources emit their `load` event through the schema that renders them:
  const schemaEvents = inject<SchemaEventsEmitter>('schemaEvents')!
  // Sources without a resource continue the one around them:
  const resourceContext = hasResource(props.schema)
    ? markRaw(
        new ResourceContext({
          getResource: options => requests.getResource(options),
          submit: button => submit(button)
        })
      )
    : null
  const services = useServices({
    get sourceContext() {
      return sourceContext
    },

    ...(resourceContext && { resourceContext })
  })
  const { adminContext, routeContext } = services
  const { router } = adminContext
  const { value, context, disabled, onChange, getSchemaValue, componentPath } =
    useField(props, { services })
  const getModel = () => services.dataContext!.model
  const getBoolean = (key: string) =>
    getSchemaValue(key, { type: Boolean, default: false })

  const hasInlinedItems = () => isInlined(props.schema)
  const isList = () => isListSource(props.schema)
  // Sources linked to views edit their items in the forms of the view:
  const linksToView = computed(() => !!getViewSchema(props.schema, context))
  const paginate = computed(() => getSchemaValue('paginate', { type: Number }))

  // The list query, held by the route and remembered in the store:
  const columns = computed(
    () => getNamedSchemas(props.schema.columns) as Record<string, Schema> | null
  )
  const scopes = computed(
    () => getNamedSchemas(props.schema.scopes) as Record<string, Schema> | null
  )

  const defaultScope = computed(() => {
    const values = Object.values(scopes.value ?? {})
    return values.find(scope => scope.defaultScope) ?? values[0] ?? null
  })

  const defaultOrder = computed(() => {
    for (const column of Object.values(columns.value ?? {})) {
      const { defaultSort } = column
      if (defaultSort) {
        const direction = isString(defaultSort) ? defaultSort : 'asc'
        return `${column.name} ${direction}`
      }
    }
    return null
  })

  const listQuery = markRaw(
    new ListQuery({
      router,
      getRoute: () => router.currentRoute.value,
      getSourceStore: () => props.store,
      getDefaultQuery: () => ({
        scope: defaultScope.value?.name,
        page: props.schema.page,
        order: defaultOrder.value
      })
    })
  )

  // Setting the query navigates to it, and the stored query only changes once
  // the route did, when the route watcher below loads the list:
  const query = computed({
    get: () => listQuery.query,
    set: query => listQuery.update(query)
  })

  const total = computed({
    get: () => props.store.total,
    set: total => (props.store.total = total)
  })

  const paginationRange = computed(() => {
    const amount = isList() ? paginate.value : null
    if (amount) {
      const { page = 0 } = query.value
      const start = page * amount
      return [start, start + amount - 1]
    }
    return null
  })

  const sourceData = useSourceData(props, {
    services,
    value,
    total,
    getPageOffset: () => paginationRange.value?.[0]
  })
  const { isObjectSource, listData, objectData, listEntry } = sourceData

  const requests = useResource({
    services,
    parentRouteContext: routeContext,
    getSchema: () => props.schema,
    isTransient: providesData => (
      (!providesData && !linksToView.value) || !!routeContext?.state.isTransient
    ),
    hasData: () => sourceData.hasData.value,
    clearData: () => sourceData.clearData(),
    setLoadedData(data) {
      if (routeContext?.isForm) {
        getModel().removeError(props.dataPath, unauthorizedError)
      }
      sourceData.setData(data)
    },
    // Pass the pagination as range, so that the server counts the results:
    getQuery() {
      const range = paginationRange.value
      const { page, ...params } = query.value
      return { ...params, ...(range && { range: range.join(',') }) }
    },
    whenQueryNavigated: () => listQuery.whenNavigated(),
    handleLoadError({ data, status }) {
      if (data?.type === 'FilterValidation' && onFilterErrors?.(data.errors)) {
        return true
      } else if (status === 401 && routeContext?.isForm) {
        // Sources in forms show that the user may not access their resource:
        getModel().addError(props.dataPath, unauthorizedError)
        return true
      }
      return false
    },
    emitLoad: () => schemaEvents.emitEvent('load'),
    getData: () => props.data,
    showValidationErrors: errors =>
      services.dataContext!.showValidationErrors(errors, props.dataPath)
  })
  const { isTransient, providesData, reloadData } = requests

  watch(
    () => router.currentRoute.value,
    (to, from) => {
      if (
        providesData.value &&
        // Only the query changed:
        from.path === to.path &&
        from.hash === to.hash &&
        listQuery.setFromRoute(to.query)
      ) {
        reloadData()
      }
    },
    // https://github.com/vuejs/vue-router/issues/3393#issuecomment-1158470149
    { flush: 'post' }
  )

  const { getItemId, getItemLabel, getItemDataPath, getItemFormSchema } =
    useItemLabel({
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
  const getViewItemPath = (key: string | undefined) => {
    const route = (
      key != null &&
      adminContext.routeTree?.getViewItemRoute(props.schema.view, key)
    )
    return route ? adminContext.router.resolve(route).path : null
  }

  const getItemStore = (item: Data) =>
    itemStores.getStore(getItemUid(props.schema, item))

  // Create an item with the form `schema`, of `type` if the source has several
  // forms, and insert it at `index`, or else at the end:
  const createItem = (
    schema: Schema,
    type?: string | null,
    index?: number | null
  ) => {
    const item = initializeData(schema, type ? { type } : {}, services)
    if (isObjectSource.value) {
      objectData.value = item
    } else if (sourceData.hasData.value) {
      getModel().insert(
        listEntry.value,
        index ?? listEntry.value.list.length,
        item
      )
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
              props.data[props.schema.name] = null
            }
          } else {
            getModel().remove(listEntry.value, currentIndex)
            if (!isTransientItem) {
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
            getItemId(props.schema, item, currentIndex),
            requests.getResource({ method })
          )
        )
        let isDeleted = false
        if (memberResource) {
          await requests.handleRequest(
            { method, resource: memberResource },
            err => {
              if (!err) {
                removeIfPresent()
                isDeleted = true
              }
              reloadData()
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
    const { editCount } = model
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
        requests.getPayloadData(button, method)
      )
      if (isSuccessful) {
        // Saving the source's own changes clears their errors, as in forms:
        model.markClean({ dataPath: props.dataPath, editCount })
        model.clearErrors(props.dataPath)
      }
      return isSuccessful
    }
    return false
  }

  // Leaving the route waits for pending submits:
  const submit = (button: SubmitButton) =>
    getModel().trackPendingSubmit(submitData(button))

  const render = computed(() =>
    getSchemaValue('render', { type: Function, default: null })
  )

  const getSourceItemLabel = (item: any, index: number | null = null) => {
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
              data: item,
              value: item,
              index,
              dataPath: getItemDataPath(schema, index)
            })
          )
        : getItemLabel(schema, item, { index })
    }
  }

  const sourceNode = computed(() => {
    const path = (
      routeContext &&
      getRelativeDataPath(props.dataPath, routeContext.dataPath)
    )
    return routeContext && path !== null
      ? (routeContext.node as ViewNode | FormNode).findSource(path)
      : null
  })

  // Lists with routed forms don't render where the recursion of forms that
  // contain themselves stops. Sources without data and resource render, e.g.
  // for `compute()`:
  const isReady = computed(
    () => (
      (hasInlinedItems() || !sourceNode.value?.isBeyondMaxDepth) &&
      (sourceData.hasData.value || !providesData.value)
    )
  )

  const sourceContext: SourceContext = reactive({
    schema: toRef(props, 'schema'),
    node: sourceNode,
    query,
    listQuery,
    dataPath: toRef(props, 'dataPath'),
    componentPath,
    store: toRef(props, 'store'),
    isDisabled: disabled,
    createItem,
    getSourceItemLabel,
    reload: reloadData,
    submit,
    verbs: requests.verbs,
    resourceContext
  })

  provide('sourceContext', sourceContext)
  if (resourceContext) {
    provide('resourceContext', resourceContext)
  }
  routeContext?.registerSource(sourceContext, true)
  onUnmounted(() => routeContext?.registerSource(sourceContext, false))

  if (providesData.value) {
    listQuery.syncWithRoute()
    requests.ensureData()
  }

  return {
    value,
    context,
    componentPath,
    disabled,
    onChange,
    services,
    isLoading: requests.isLoading,
    loadData: requests.loadData,
    reloadData,
    listQuery,
    query,
    total,
    columns,
    scopes,
    defaultScope,
    paginate,
    isListSource: sourceData.isListSource,
    isObjectSource,
    listData,
    objectData,
    listEntry,
    getItemUid,
    getItemFormSchema,
    getItemDataPath,
    creatable,
    editable,
    deletable,
    draggable,
    collapsible,
    collapsed,
    getItemStore,
    createItem,
    deleteItem,

    createPath: computed(() =>
      creatable.value
        ? linksToView.value
          ? getViewItemPath('create')
          : (routeContext?.getCreatePath(props.dataPath) ?? null)
        : null
    ),

    // Object sources are their own item:
    objectPath: computed(() =>
      linksToView.value
        ? objectData.value &&
          getViewItemPath(getItemId(props.schema, objectData.value))
        : (routeContext?.getFormPath(props.dataPath) ?? null)
    ),

    getItemPath(index: number) {
      return linksToView.value
        ? getViewItemPath(getItemId(props.schema, listData.value[index], index))
        : (routeContext?.getFormPath(
            appendDataPath(props.dataPath, index)
          ) ?? null)
    },

    ownSourceContext: sourceContext,
    sourceNode,
    isReady,
    isInlined: computed(hasInlinedItems),
    buttonSchemas: computed(() => getButtonSchemas(props.schema.buttons))
  }
}
