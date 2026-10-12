import { computed, getCurrentInstance, inject, onBeforeMount, ref } from 'vue'
import { camelize } from '@ditojs/utils'
import { getSchemaEventEntries } from '../utils/schema/events.js'
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
    createContext,
    value,
    parsedValue,
    getEvents,
    validate
  }: Pick<SchemaContext, 'createContext'> & Value & FieldEventsOptions
) {
  // The component's emitter calls the handlers of the schema's events, see
  // `DitoMixin.emitEvent()`:
  const component = getCurrentInstance()!.proxy as any
  const getSchemaComponent = inject<() => any>('$schemaComponent')!
  const focused = ref(false)

  onBeforeMount(() => component.setupEvents())

  const emitEvent = (
    event: string,
    {
      context = {},
      parent = null
    }: { context?: Record<string, any>; parent?: any } = {}
  ) => component.emitEvent(event, { context: createContext(context), parent })

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
        },
        // Pass the schema component as parent, so change events propagate up:
        parent: getSchemaComponent()
      })
    }
  }

  // The handlers to bind to the element of the component, with the ones of the
  // events that the schema handles and the component doesn't:
  const events = computed(() => {
    const events = getEvents ? getEvents(handlers) : { ...handlers }
    // Assume that the events that the schema handles and the component doesn't
    // are native events, in both forms, `events: { mouseenter }` and
    // `onMouseenter`:
    for (const { event } of getSchemaEventEntries(props.schema)) {
      events[`on${camelize(event, true)}`] ??= () => emitEvent(event)
    }
    return events
  })

  return { ...handlers, focused, events, emitEvent }
}
