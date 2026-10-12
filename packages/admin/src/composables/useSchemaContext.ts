import { inject, markRaw, unref } from 'vue'
import SchemaContext from '../SchemaContext.js'
import { getLastDataPathName } from '../utils/data.js'
import {
  adminContextKey,
  dataContextKey,
  resourceContextKey,
  routeContextKey,
  sourceContextKey
} from '../utils/keys.ts'
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
// them, e.g. sources their own source. Raw, so that containers can hand them on
// through reactive objects:
export function useServices(ownServices: Partial<Services> = {}): Services {
  const sourceContext = inject(sourceContextKey, null)
  return markRaw(
    Object.defineProperties(
      {
        adminContext: inject(adminContextKey)!,
        dataContext: inject(dataContextKey, null),
        routeContext: inject(routeContextKey, null),
        resourceContext: inject(resourceContextKey, null),

        get sourceContext() {
          return unref(sourceContext)
        }
      },
      Object.getOwnPropertyDescriptors(ownServices)
    )
  )
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
    new SchemaContext(services, () =>
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

export type SchemaContextSetup = ReturnType<typeof useSchemaContext>
