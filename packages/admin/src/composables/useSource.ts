import {
  computed,
  getCurrentInstance,
  inject,
  markRaw,
  onUnmounted,
  provide,
  reactive,
  toRef
} from 'vue'
import DitoContext from '../DitoContext.js'
import { getRelativeDataPath } from '../utils/data.js'
import { getResource } from '../utils/resource.js'
import {
  ResourceContext,
  type SubmitButton
} from '../utils/ResourceContext.ts'
import type { SourceContext } from '../utils/SourceContext.ts'
import type { FormNode, ViewNode } from '../utils/RouteTree.ts'
import { getButtonSchemas, getViewSchema } from '../utils/schema/lookup.js'
import { isInlined } from '../utils/schema/structure.js'
import { useField, type FieldProps } from './useField.ts'
import { useServices } from './useSchemaContext.ts'
import { useResource } from './useResource.ts'
import { useResourceSubmit } from './useResourceSubmit.ts'
import { useListQuery } from './useListQuery.ts'
import { useSourceData } from './useSourceData.ts'
import { useSourceActions } from './useSourceActions.ts'
import { useItemLabel } from './useItemLabel.ts'

const unauthorizedError = `You don't have permission to load this data.`

// A list, object or tree: its items, query, actions and resource, and the
// `source` and `resource` contexts that it provides to its components.
export function useSource(
  props: FieldProps,
  {
    // Show the errors of the filters that the server rejected, and return
    // whether they're shown:
    onFilterErrors
  }: { onFilterErrors?: (errors: Record<string, any>) => boolean } = {}
) {
  // NOTE: The component path, the waiting for the data model and the schema
  // components of the inlined items are still members of the component:
  const component = getCurrentInstance()!.proxy as any
  const getSchemaComponent = inject<() => any>('$schemaComponent')!
  const services = useServices({
    get source() {
      return source
    },

    get resource() {
      return resource
    }
  })
  const { admin, route } = services
  const field = useField(props, { services })
  const { value, context, disabled, onChange, getSchemaValue } = field
  const getModel = () => services.container!.model

  const hasInlinedItems = () => isInlined(props.schema)
  // Sources linked to views edit their items in the forms of the view:
  const linksToView = () => !!getViewSchema(props.schema, context)
  const paginate = computed(() => getSchemaValue('paginate', { type: Number }))

  const requests = useResource({
    services,
    parentRoute: route,
    getSchema: () => props.schema,
    isTransient: providesData => (
      (!providesData && !linksToView()) || !!route?.state.isTransient
    ),
    hasData: () => sourceData.hasData.value,
    clearData: () => sourceData.clearData(),
    setLoadedData(data) {
      if (route?.isForm) {
        getModel().removeError(props.dataPath, unauthorizedError)
      }
      sourceData.setData(data)
    },
    getQuery: () => listQuery.getQueryParams(),
    whenQueryNavigated: () => listQuery.listQuery.whenNavigated(),
    handleLoadError({ data, status }) {
      if (data?.type === 'FilterValidation' && onFilterErrors?.(data.errors)) {
        return true
      } else if (status === 401 && route?.isForm) {
        // The user is logged in, but may not access the resource of a source
        // in a form. Show it on the source, as several sources of the form
        // may be affected:
        getModel().addError(props.dataPath, unauthorizedError)
        return true
      }
      return false
    },
    emitLoad: () => getSchemaComponent().emitEvent('load')
  })

  const listQuery = useListQuery(props, {
    admin,
    paginate: () => paginate.value,
    providesData: () => requests.providesData.value,
    reloadData: requests.reloadData
  })

  const sourceData = useSourceData(props, {
    services,
    value,
    total: listQuery.total,
    getPageOffset: () => listQuery.paginationRange.value?.[0]
  })

  const itemLabel = useItemLabel({
    services,
    getContext: () => context,
    getSchema: () => props.schema,
    getDataPath: () => props.dataPath,
    isTransient: () => requests.isTransient.value
  })

  const actions = useSourceActions(props, {
    services,
    sourceData,
    resource: requests,
    itemLabel,
    isInlined: hasInlinedItems,
    linksToView,
    getSchemaValue,
    onChange
  })

  const { getPayloadData, submitResource } = useResourceSubmit({
    admin,
    handleRequest: requests.handleRequest,
    getData: () => props.data,
    showValidationErrors: errors =>
      getSchemaComponent().showValidationErrors(errors, props.dataPath)
  })

  // Submit the data of the source to the resource of the button:
  const submit = async (button: SubmitButton) => {
    // Wait for the data that's still loading, e.g. uploads, like forms do:
    await component.waitUntilDataModelSettled()
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
      const isSuccessful = await submitResource(
        button,
        submitted,
        method,
        getPayloadData(button, method)
      )
      if (isSuccessful) {
        // The source saved its own changes, e.g. the order of its items, which
        // clears their errors, like saving forms does:
        model.markClean({ dataPath: props.dataPath, editCount })
        model.clearErrors(props.dataPath)
      }
      return isSuccessful
    }
    return false
  }

  const render = computed(() =>
    getSchemaValue('render', { type: Function, default: null })
  )

  const getSourceItemLabel = (item: any, index: number | null = null) => {
    const { schema } = props
    if (hasInlinedItems()) {
      // Inlined items show the label in their schema, but only in lists and
      // collapsible objects:
      return sourceData.isListSource.value || actions.collapsible.value
        ? itemLabel.getItemLabel(schema, item, { index, asObject: true })
        : null
    } else {
      return render.value
        ? render.value(
            new DitoContext(services, {
              data: item,
              value: item,
              index,
              dataPath: itemLabel.getItemDataPath(schema, index)
            })
          )
        : itemLabel.getItemLabel(schema, item, { index })
    }
  }

  // The node of the source in the route tree, if it has a route:
  const sourceNode = computed(() => {
    const path = route && getRelativeDataPath(props.dataPath, route.dataPath)
    return route && path !== null
      ? (route.node as ViewNode | FormNode).findSource(path)
      : null
  })

  // Lists with routed forms don't render where the recursion of forms that
  // contain themselves stops, see `maxDepth`. Sources without data and without
  // resource render too, as they may get their data elsewhere, e.g. through
  // `compute()`:
  const isReady = computed(
    () => (
      (hasInlinedItems() || !sourceNode.value?.isBeyondMaxDepth) &&
      (sourceData.hasData.value || !requests.providesData.value)
    )
  )

  const source: SourceContext = reactive({
    schema: toRef(props, 'schema'),
    node: sourceNode,
    query: listQuery.query,
    listQuery: listQuery.listQuery,
    dataPath: toRef(props, 'dataPath'),
    componentPath: computed(() => component.componentPath),
    store: toRef(props, 'store'),
    isDisabled: disabled,
    createItem: actions.createItem,
    getSourceItemLabel,
    reload: requests.reloadData
  })

  const resource = markRaw(
    new ResourceContext(
      reactive({
        verbs: requests.verbs,
        dataModel: computed(getModel),
        getResource: requests.getResource,
        submit
      }),
      { route }
    )
  )

  provide('source', source)
  provide('resource', resource)
  route?.registerSource(source, true)
  onUnmounted(() => route?.registerSource(source, false))

  if (requests.providesData.value) {
    listQuery.listQuery.syncWithRoute()
    requests.ensureData()
  }

  return {
    value,
    context,
    disabled,
    onChange,
    focus: field.focus,
    services,
    ...requests,
    ...listQuery,
    ...sourceData,
    ...actions,
    ...itemLabel,
    ownSource: source,
    ownResource: resource,
    sourceSchema: computed(() => props.schema),
    sourceNode,
    isReady,
    isInlined: computed(hasInlinedItems),
    paginate,
    buttonSchemas: computed(() => getButtonSchemas(props.schema.buttons)),

    // Reveal the components of the inlined item that display the value at
    // `dataPath`, see `DitoSchema.revealComponents()`:
    async revealComponents(dataPath: string) {
      const schemaComponent = component.schemaComponents.find(
        (it: any) => getRelativeDataPath(dataPath, it.dataPath) !== null
      )
      return (await schemaComponent?.revealComponents(dataPath)) ?? []
    }
  }
}
