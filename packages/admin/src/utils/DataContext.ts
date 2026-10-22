import { nextTick, shallowReactive } from 'vue'
import {
  isEmpty,
  labelize,
  normalizeDataPath,
  parseDataPath
} from '@ditojs/utils'
import SchemaContext from '../SchemaContext.js'
import { appendDataPath } from './data.js'
import { getText } from './html.js'
import { getLabel } from './schema/data.js'
import {
  getDataPathMatcher,
  getDataValidationErrors,
  getMatchingValidationErrors
} from './schema/validation.js'
import type { DataModel, ValueError } from './DataModel.ts'
import type { SubmitButton, SubmitOptions } from './ResourceContext.ts'
import type { Services } from './services.ts'
import type { SourceContext } from './SourceContext.ts'
import type { Data, Schema } from './types.ts'

type Match = string | string[] | RegExp | ((dataPath: string) => boolean)

type Errors = Record<string, ValueError[]>

// Without a button, forms submit with their submit button:
type Submit = (
  button: SubmitButton | null,
  options?: SubmitOptions
) => Promise<boolean>

// The data of a view, form, dialog or panel with its own data, and its state.
export interface DataContext {
  // The model that holds the data, the parent's in forms that edit its item:
  readonly model: DataModel
  readonly services: Services
  // The schema that displays the data at `dataPath`, at `componentPath`:
  readonly schema: Schema
  readonly data: Data | null
  readonly dataPath: string
  readonly componentPath: string
  readonly isDirty: boolean
  readonly isCreating: boolean
  readonly hasData: boolean
  // The sources in the data, e.g. to reload the list of a saved item:
  readonly sources: Set<SourceContext>
  // Dialogs and the containers in them, e.g. panels with their own data:
  readonly closeDialog: ((value?: unknown) => void) | null
  // The responses of `request({ cache: 'local' })`:
  readonly loadCache: Record<string, Promise<unknown>> | null
  // Forms and the containers in them, e.g. panels with their own data:
  readonly submit: Submit | null
  // The verbs of forms that submit through it, e.g. `save` or `create`:
  readonly verbs: Record<string, string> | null
  validate(match?: Match): boolean
  verify(match?: Match): boolean
  getErrors(match?: Match): Errors | null
  clearErrors(match?: Match): void
  showValidationErrors(errors: Errors, dataPath?: string): Promise<void>
  revealErrors(): Promise<string[]>
  markEdited(): void
  resetItem(data: any): any
  mergeItem(data: any): any
}

export interface DataContextOptions {
  getModel(): DataModel
  services: Services
  getSchema(): Schema
  getData(): Data | null
  getDataPath(): string
  getComponentPath(): string
  isCreating(): boolean
  closeDialog: ((value?: unknown) => void) | null
  loadCache: Record<string, Promise<unknown>> | null
  submit: Submit | null
  getVerbs(): Record<string, string> | null
  resetItem(data: any): any
  mergeItem(data: any): any
  // Forms take over the errors of their item in the parent's data:
  copyErrors?: () => void
}

export function createDataContext({
  getModel,
  services,
  getSchema,
  getData,
  getDataPath,
  getComponentPath,
  isCreating,
  closeDialog,
  loadCache,
  submit,
  getVerbs,
  resetItem,
  mergeItem,
  copyErrors
}: DataContextOptions): DataContext {
  // Validate the data, not the mounted components, to include collapsed
  // schemas and closed nested forms:
  const getValidationErrors = (match?: Match): Errors | null => {
    const { schema, data, dataPath, model } = context
    const errors = data
      ? getDataValidationErrors(schema, data, {
          dataPath,
          services,
          rootData: model.rootData
        })
      : null
    return match ? getMatchingValidationErrors(errors, match) : errors
  }

  // Notify the errors that no mounted component displays once they're revealed:
  const showErrors = async (
    errors: Errors,
    {
      dataPath = context.dataPath,
      server = false,
      match
    }: { dataPath?: string; server?: boolean; match?: Match } = {}
  ) => {
    const fieldDataPaths = context.model.replaceErrors(errors, {
      dataPath,
      server,
      isMatchingDataPath: match ? getDataPathMatcher(match) : null
    })
    const displayedDataPaths = await revealErrorDataPaths([
      ...new Set(Object.values(fieldDataPaths))
    ])
    if (!isEmpty(errors)) {
      // The label of the data's schema, also for the errors of its sources:
      const { schema, data } = context
      const label = getText(
        getLabel(
          schema,
          new SchemaContext(services, {
            schema,
            nested: false,
            data,
            dataPath: context.dataPath
          })
        )
      )
      const messages = Object.entries(errors)
        .filter(
          ([dataPath]) => !displayedDataPaths.includes(fieldDataPaths[dataPath])
        )
        .flatMap(([dataPath, errs]) => {
          const field = labelize(parseDataPath(dataPath).pop())
          const prefix = field ? `The field ${field}` : `The ${label}`
          return errs.map(({ message }) => `${prefix} ${message}`)
        })
      services.adminContext.notify({
        type: 'error',
        title: 'Validation Errors',
        text: messages.join('\n') || 'Please correct the highlighted errors.'
      })
    }
  }

  // Reveal the errors of the fields at `dataPaths`, and return the data paths
  // of the ones that mounted components display then. Fields in the forms of
  // nested routes open the form, which reveals the errors that it takes over
  // from its item:
  const revealErrorDataPaths = async (dataPaths: string[]) => {
    const { adminContext, routeContext } = services
    const { router, ui } = adminContext
    const [firstDataPath] = dataPaths
    // Dialogs and panels with their own data aren't part of routes:
    const formRoute =
      firstDataPath && routeContext?.dataContext === context
        ? routeContext.getFormRoute(firstDataPath)
        : null
    const displayedDataPaths: string[] = []
    if (formRoute) {
      // The form may be open already, e.g. a nested form:
      const failure =
        router.currentRoute.value.path !== formRoute.path
          ? await router.push({ path: formRoute.path })
          : null
      if (!failure) {
        await nextTick()
        const level = router.currentRoute.value.matched.length - 1
        displayedDataPaths.push(
          ...(await ui.routes[level].dataContext.revealErrors())
        )
      }
    }
    // Collapsed schemas render their content with errors hidden, so we can
    // find the components that display them:
    await nextTick()
    const componentPathsByDataPath = new Map(
      dataPaths.map(dataPath => [
        dataPath,
        ui.getErrorComponentPaths(context, dataPath)
      ])
    )
    if (!formRoute) {
      // Reveal them, and focus the first one:
      const componentPaths = [...componentPathsByDataPath.values()].flat()
      for (const componentPath of componentPaths) {
        await ui.reveal(context, componentPath, {
          focus: componentPath === componentPaths[0]
        })
      }
    }
    return [
      ...displayedDataPaths,
      ...dataPaths.filter(
        dataPath => componentPathsByDataPath.get(dataPath)!.length > 0
      )
    ]
  }

  const context: DataContext = shallowReactive({
    get model() {
      return getModel()
    },

    services,

    get schema() {
      return getSchema()
    },

    get data() {
      return getData()
    },

    get dataPath() {
      return getDataPath()
    },

    get componentPath() {
      return getComponentPath()
    },

    get isDirty() {
      return getModel().isDirty
    },

    get isCreating() {
      return isCreating()
    },

    get hasData() {
      return !!getData()
    },

    sources: shallowReactive(new Set<SourceContext>()),
    closeDialog,
    loadCache,
    submit,

    get verbs() {
      return getVerbs()
    },

    validate(match?: Match) {
      const errors = getValidationErrors(match)
      showErrors(errors ?? {}, { match }).catch(console.error)
      return !errors
    },

    verify(match?: Match) {
      return !getValidationErrors(match)
    },

    // The errors that the model holds, by the data paths of their values:
    getErrors(match?: Match) {
      const model = getModel()
      const errors: Errors = {}
      const addError = (dataPath: string, error: ValueError) => {
        errors[dataPath] = [...(errors[dataPath] ?? []), error]
      }
      for (const dataPath of model.getErrorDataPaths(getDataPath())) {
        for (const { path, ...error } of model.getErrors(dataPath) ?? []) {
          addError(path ? appendDataPath(dataPath, path) : dataPath, error)
        }
        for (const message of model.getFieldErrors(dataPath) ?? []) {
          addError(dataPath, { message })
        }
      }
      return match
        ? getMatchingValidationErrors(errors, match)
        : isEmpty(errors)
          ? null
          : errors
    },

    // Clear the errors at the matching data paths and beneath them:
    clearErrors(match?: Match) {
      const model = getModel()
      if (match) {
        const isMatchingDataPath = getDataPathMatcher(match)
        const isWithinMatch = (dataPath: string) => {
          const path = parseDataPath(dataPath)
          return path.some((_, index) =>
            isMatchingDataPath(normalizeDataPath(path.slice(0, index + 1)))
          )
        }
        for (const dataPath of model.getErrorDataPaths(getDataPath())) {
          if (isWithinMatch(dataPath)) {
            model.clearErrors(dataPath)
          }
        }
      } else {
        model.clearErrors(getDataPath())
      }
    },

    // Show the server's errors of the data that was sent, at `dataPath`. Their
    // paths in property access notation lack the data path of the sent data:
    showValidationErrors(errors: Errors, dataPath = getDataPath()) {
      return showErrors(
        Object.fromEntries(
          Object.entries(errors).map(([path, errs]) => [
            normalizeDataPath(appendDataPath(dataPath, path)),
            errs
          ])
        ),
        { dataPath, server: true }
      )
    },

    // Forms take over the errors of their item first, also when they're open
    // already, e.g. when their parent shows its errors:
    revealErrors() {
      copyErrors?.()
      return revealErrorDataPaths(getModel().getErrorDataPaths(getDataPath()))
    },

    markEdited() {
      getModel().markEdited()
    },

    resetItem,
    mergeItem
  })
  return context
}
