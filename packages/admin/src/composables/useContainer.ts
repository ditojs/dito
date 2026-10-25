import {
  computed,
  inject,
  markRaw,
  onBeforeUnmount,
  provide,
  reactive,
  unref,
  type MaybeRef
} from 'vue'
import { createDataContext, type DataContext } from '../utils/DataContext.ts'
import { DataModel } from '../utils/DataModel.ts'
import {
  dataContextKey,
  resourceContextKey,
  routeContextKey,
  sourceContextKey,
  sourceSchemaKey
} from '../utils/keys.ts'
import { useServices } from './useSchemaContext.ts'
import type { ResourceContext } from '../utils/ResourceContext.ts'
import type { RouteContext } from '../utils/RouteContext.ts'
import type { Services } from '../utils/services.ts'
import type { SourceContext } from '../utils/SourceContext.ts'
import type { Data, Schema } from '../utils/types.ts'

export interface ContainerOptions {
  schema: () => Schema
  // The data that the model starts with:
  data?: Data | null
  dataPath?: () => string
  // The data that `dataPath` is relative to, by default the model's data:
  rootData?: (data: Data | null) => Data | null
  // The schema of the source of the data's item:
  sourceSchema?: () => Schema | null
  componentPath?: () => string
  isCreating?: () => boolean
  canSave?: () => boolean
  // The model of the parent's data, which serializes the root data of nested
  // forms, and holds the item of forms that edit it in place:
  parentModel?: () => DataModel | null
  getParentItem?: () => Data | null
  isEditingParentItem?: () => boolean
  resetItem?: (data: any) => any
  mergeItem?: (data: any) => any
  copyErrors?: () => void
  closeDialog?: (value?: unknown) => void
  // Forms apply their data to their parent, or save it through their resource:
  submit?: DataContext['submit']
  // The verbs of forms that submit, which their buttons read:
  verbs?: () => Record<string, string>
  // Forms with a resource of their own outside of routes:
  resourceContext?: ResourceContext | null
  // Views and forms, which also provide the resource of the route:
  routeContext?: RouteContext
  // Views provide the source of their main component, forms none:
  sourceContext?: MaybeRef<SourceContext | null>
  // The store of the schema that displays the data, e.g. of a panel with its
  // own data, else a new one:
  store?: Record<string, any>
}

// Set up the data of a view, form, dialog or panel with its own data: its model
// and data context, and the services of its components, which it provides.
export function useContainer({
  schema,
  data = null,
  dataPath = () => '',
  rootData,
  sourceSchema = () => null,
  componentPath = () => '',
  isCreating = () => false,
  canSave,
  parentModel = () => null,
  getParentItem = () => null,
  isEditingParentItem = () => false,
  resetItem,
  mergeItem,
  copyErrors,
  closeDialog,
  submit,
  verbs,
  resourceContext,
  routeContext,
  sourceContext,
  store = reactive({})
}: ContainerOptions) {
  const parentDataContext = inject(dataContextKey, null)
  const hasSourceContext = sourceContext !== undefined
  // The model runs callbacks while it's created, without a data context yet:
  let dataContext: DataContext | null = null
  const ownServices: Partial<Services> = {
    get dataContext() {
      return dataContext
    }
  }
  if (routeContext) {
    Object.assign(ownServices, {
      routeContext,
      resourceContext: routeContext.resourceContext
    })
  } else if (resourceContext) {
    Object.assign(ownServices, { resourceContext })
  }
  if (hasSourceContext) {
    // Spreading would read the getter of the main source of views too early:
    Object.defineProperty(ownServices, 'sourceContext', {
      get: () => unref(sourceContext)
    })
  }
  const services = useServices(ownServices)
  // Forms that edit the item of their parent edit it through the parent's
  // model, which holds its state:
  const model = markRaw(
    new DataModel({
      schema,
      data,
      ...(rootData && { rootData }),
      dataPath,
      sourceSchema,
      parent: parentModel,
      ...(canSave && { canSave }),
      services
    })
  )
  // The model's watchers aren't the component's, see `DataModel`:
  onBeforeUnmount(() => model.stop())

  dataContext = createDataContext({
    getModel: () => (isEditingParentItem() ? parentModel()! : model),
    services,
    getSchema: schema,
    getData: () => (isEditingParentItem() ? getParentItem() : model.data),
    getDataPath: dataPath,
    getComponentPath: componentPath,
    isCreating,
    // Panels with their own data close the dialog that they're in:
    closeDialog: closeDialog ?? parentDataContext?.closeDialog ?? null,
    // Panels with their own data submit the form that they're in:
    submit: submit ?? parentDataContext?.submit ?? null,
    getVerbs: verbs ?? (() => parentDataContext?.verbs ?? null),
    // Views, forms and dialogs cache while they're shown, panels share theirs:
    loadCache:
      routeContext || closeDialog
        ? {}
        : (parentDataContext?.loadCache ?? null),
    // By default, the data is replaced:
    resetItem: (
      resetItem ??
      (data => {
        model.replaceFromServer(data)
        return model.data
      })
    ),
    mergeItem: (
      mergeItem ??
      (data => model.mergeFromServer(data, { isPartial: true }))
    ),
    copyErrors,
    store
  })

  provide(dataContextKey, dataContext)
  provide(sourceSchemaKey, computed(sourceSchema))
  if (routeContext) {
    provide(routeContextKey, routeContext)
    provide(resourceContextKey, routeContext.resourceContext)
  } else if (resourceContext) {
    provide(resourceContextKey, resourceContext)
  }
  if (hasSourceContext) {
    provide(sourceContextKey, sourceContext)
  }
  return { dataContext, model, services, store }
}
