import { computed, ref } from 'vue'
import { camelize } from '@ditojs/utils'
import { getSchemaEventEntries } from '../utils/schema/events.js'
import { useSchemaEvents } from './useSchemaEvents.ts'
import type { SchemaContext, SchemaContextProps } from './useSchemaContext.ts'
import type { Value } from './useValue.ts'

type Handler = (...args: any[]) => any

export interface FieldEventHandlers {
  onFocus(): void
  onBlur(): void
  onInput(): void
  onChange(): void
}

export interface FieldEventsOptions {
  // The handlers that the element of the component binds, by default all of
  // `FieldEventHandlers`:
  getEvents?: (handlers: FieldEventHandlers) => Record<string, Handler>
  // Validate the value when the element loses focus:
  validate(): boolean
}

// Emit the events of the schema for the edits of the component, which handlers
// receive with the component's context.
export function useFieldEvents(
  props: SchemaContextProps,
  {
    services,
    createContext,
    value,
    parsedValue,
    getEvents,
    validate
  }: Omit<SchemaContext, 'context'> & Value & FieldEventsOptions
) {
  const { emitEvent } = useSchemaEvents(() => props.schema, {
    services,
    createContext
  })
  const focused = ref(false)

  const handlers: FieldEventHandlers = {
    onFocus() {
      focused.value = true
      emitEvent('focus')
    },

    onBlur() {
      focused.value = false
      validate()
      emitEvent('blur')
    },

    onInput() {
      emitEvent('input')
    },

    onChange() {
      emitEvent('change', {
        context: {
          // Prevent endless parse recursion:
          value:
            parsedValue.value !== undefined ? parsedValue.value : value.value
        }
      })
    }
  }

  // The handlers to bind to the element, with the ones of the events that the
  // schema handles and the component doesn't, which are native events:
  const events = computed(() => {
    const events = getEvents ? getEvents(handlers) : { ...handlers }
    for (const { event } of getSchemaEventEntries(props.schema)) {
      events[`on${camelize(event, true)}`] ??= () => emitEvent(event)
    }
    return events
  })

  return { ...handlers, focused, events, emitEvent }
}
