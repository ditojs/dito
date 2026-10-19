import { inject, markRaw, onUnmounted, unref } from 'vue'
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

export interface SchemaContextProps {
  readonly schema: Schema
  readonly data: Data
  readonly dataPath: string
  readonly nested: boolean
  // The data path of `data`, if it isn't derived from `dataPath`:
  readonly itemDataPath?: string | null
}

// Components without a schema or data of their own, e.g. buttons, leave them
// out, and the ones that don't tell are unnested:
type ContextProps = Pick<SchemaContextProps, 'dataPath' | 'itemDataPath'> & {
  readonly schema?: Schema | null
  readonly data: Data | null
  readonly nested?: boolean
}

// The services that the component sees: the ones provided above, unless it owns
// them, e.g. sources their own source, and the signal that aborts its requests
// when it unmounts. Raw, so that containers can hand them on through reactive
// objects:
export function useServices(ownServices: Partial<Services> = {}): Services {
  const sourceContext = inject(sourceContextKey, null)
  const controller = new AbortController()
  onUnmounted(() => controller.abort())
  return markRaw(
    Object.defineProperties(
      {
        adminContext: inject(adminContextKey)!,
        dataContext: inject(dataContextKey, null),
        routeContext: inject(routeContextKey, null),
        resourceContext: inject(resourceContextKey, null),
        signal: controller.signal,

        get sourceContext() {
          return unref(sourceContext)
        }
      },
      Object.getOwnPropertyDescriptors(ownServices)
    )
  )
}

// `getValue()` returns the value that the component displays, e.g. after
// `formatValue()`.
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
          },

          get itemDataPath() {
            return props.itemDataPath
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
