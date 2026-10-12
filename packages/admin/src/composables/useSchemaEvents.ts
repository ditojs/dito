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

export interface SchemaEventsEmitter {
  readonly events: SchemaEvents
  emitEvent(event: string, options?: EmitOptions): Promise<any>
}

// Events bubble to the schema above, unless the component is `isolated()`:
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
        // The handlers see the values that the model derives from the data:
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
