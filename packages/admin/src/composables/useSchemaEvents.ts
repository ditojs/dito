import { computed, inject } from 'vue'
import DitoContext from '../DitoContext.js'
import { SchemaEvents } from '../utils/SchemaEvents.ts'
import {
  waitUntilDataModelSettled,
  type Services
} from '../utils/services.ts'
import type { Context } from '../utils/schema/types.ts'
import type { Schema } from '../utils/types.ts'

export interface EmitOptions {
  // The context of the event, or the values that it adds to the component's:
  context?: Context
  bubble?: boolean
}

// The events of a schema, which DitoSchema provides to its components: Their
// events bubble to it, and sources emit their `load` event through it.
export interface SchemaEventsEmitter {
  readonly events: SchemaEvents
  emitEvent(event: string, options?: EmitOptions): Promise<any>
}

// Emit the events of the component's schema, which the handlers receive with
// the component's context. They bubble to the closest schema above, unless the
// component is `isolated()`, e.g. a schema with its own data.
export function useSchemaEvents(
  getSchema: () => Schema,
  {
    services,
    createContext,
    isolated = () => false
  }: {
    services: Services
    createContext(values?: Context): Context
    isolated?: () => boolean
  }
): SchemaEventsEmitter {
  const parent = inject<SchemaEventsEmitter | null>('schemaEvents', null)
  const events = computed(
    () => new SchemaEvents(getSchema(), isolated() ? null : parent?.events)
  )
  return {
    get events() {
      return events.value
    },

    async emitEvent(event, { context = {}, bubble } = {}) {
      if (events.value.has(event, { bubble })) {
        // The handlers of these events see their effects, e.g. the values
        // that the data model derives from the changed data:
        if (event === 'load' || event === 'change') {
          await waitUntilDataModelSettled(services)
        }
        return events.value.emit(
          event,
          context instanceof DitoContext ? context : createContext(context),
          { bubble }
        )
      }
    }
  }
}
