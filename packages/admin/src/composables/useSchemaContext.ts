import {
  inject,
  markRaw,
  onBeforeUnmount,
  provide,
  unref,
  type MaybeRef
} from 'vue'
import DitoContext from '../DitoContext.js'
import { getLastDataPathName } from '../utils/data.js'
import { DataModel, type DataModelOptions } from '../utils/DataModel.ts'
import type { AdminContext } from '../utils/AdminContext.ts'
import type { DataContext } from '../utils/DataContext.ts'
import type { ResourceContext } from '../utils/ResourceContext.ts'
import type { RouteContext } from '../utils/RouteContext.ts'
import type { SourceContext } from '../utils/SourceContext.ts'
import type { Context } from '../utils/schema/types.ts'
import type { Services } from '../utils/services.ts'
import type { Data, Schema } from '../utils/types.ts'
import type { FieldProps } from './useField.ts'

export type SchemaContextProps = Pick<
  FieldProps,
  'schema' | 'data' | 'dataPath' | 'nested'
>

// Components without a schema or data of their own, e.g. buttons, leave them
// out, and the ones that don't tell are unnested:
type ContextProps = Pick<SchemaContextProps, 'dataPath'> & {
  readonly schema?: Schema | null
  readonly data: Data | null
  readonly nested?: boolean
}

// The services that the component sees: the ones provided above, unless it owns
// them, e.g. sources their own source.
export function useServices(ownServices: Partial<Services> = {}): Services {
  // Views provide the source and resource of their main component as refs:
  const sourceContext = inject<MaybeRef<SourceContext | null>>(
    'sourceContext',
    null
  )
  const resourceContext = inject<MaybeRef<ResourceContext | null>>(
    'resourceContext',
    null
  )
  return Object.defineProperties(
    {
      adminContext: inject<AdminContext>('adminContext')!,
      dataContext: inject<DataContext | null>('dataContext', null),
      routeContext: inject<RouteContext | null>('routeContext', null),

      get sourceContext() {
        return unref(sourceContext)
      },

      get resourceContext() {
        return unref(resourceContext)
      }
    },
    Object.getOwnPropertyDescriptors(ownServices)
  )
}

// Provide the data context of a component with its own data, with the services
// of its components. Forms create the model of the data once it's set up:
export function useContainer(
  ownServices: Partial<Services> & { dataContext: DataContext }
) {
  provide('dataContext', ownServices.dataContext)
  const services = useServices(ownServices)
  return {
    services,

    createDataModel(options: Omit<DataModelOptions, 'services'>) {
      const dataModel = markRaw(new DataModel({ ...options, services }))
      // The model's watchers aren't the component's, see `DataModel`:
      onBeforeUnmount(() => dataModel.stop())
      return dataModel
    }
  }
}

// `getValue()` returns the value that the component displays, e.g. after
// `format()`.
export function useSchemaContext(
  props: ContextProps,
  {
    services = useServices(),
    getValue = null
  }: { services?: Services; getValue?: (() => any) | null } = {}
) {
  // Create a context with `values` that add to or override the component's,
  // e.g. the `value` of an event. It reads the props when they're used:
  const createContext = (values: Record<string, any> = {}): Context =>
    new DitoContext(services, () =>
      Object.defineProperties(
        {
          get schema() {
            return props.schema ?? null
          },

          get name() {
            return props.schema?.name ?? getLastDataPathName(props.dataPath)
          },

          get nested() {
            return props.nested ?? false
          },

          get data() {
            return props.data
          },

          get dataPath() {
            return props.dataPath
          }
        },
        {
          ...(getValue && {
            value: { get: getValue, enumerable: true, configurable: true }
          }),
          ...Object.getOwnPropertyDescriptors(values)
        }
      )
    )

  return {
    context: createContext(),
    createContext,
    services
  }
}

export type SchemaContext = ReturnType<typeof useSchemaContext>
