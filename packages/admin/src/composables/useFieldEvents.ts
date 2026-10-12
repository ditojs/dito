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
  // Bind all handlers by default:
  getEvents?: (handlers: FieldEventHandlers) => Record<string, Handler>
  // Called on blur:
  validate(): boolean
}

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

  // Schema events that the component doesn't handle are native events:
  const events = computed(() => {
    const events = getEvents ? getEvents(handlers) : { ...handlers }
    for (const { event } of getSchemaEventEntries(props.schema)) {
      events[`on${camelize(event, true)}`] ??= () => emitEvent(event)
    }
    return events
  })

  return { ...handlers, focused, events, emitEvent }
}
