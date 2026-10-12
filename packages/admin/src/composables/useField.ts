import { computed, ref, type ExtractPropTypes, type PropType } from 'vue'
import { camelize } from '@ditojs/utils'
import {
  getValidations,
  getValueValidationErrors
} from '../utils/schema/validation.js'
import { getInputAffixesProps } from '../utils/affixes.js'
import { getSchemaEventEntries } from '../utils/schema/events.js'
import { useSchemaContext } from './useSchemaContext.ts'
import { useValue } from './useValue.ts'
import { useSchemaValue } from './useSchemaValue.ts'
import { useComponentPath } from './useComponentPath.ts'
import { useFocus, type FocusOptions } from './useFocus.ts'
import { useSchemaEvents } from './useSchemaEvents.ts'
import type { Services } from '../utils/services.ts'
import type { Data, Schema } from '../utils/types.ts'

// The props that `DitoContainer` passes to the components of types:
export const fieldProps = {
  schema: { type: Object as PropType<Schema>, required: true },
  // NOTE: While `dataPath` points to the actual `value`, `data` represents
  // the `item` in which the `value` is contained, under the key `name`.
  dataPath: { type: String, required: true },
  data: { type: [Object, Array] as PropType<Data>, required: true },
  store: { type: Object as PropType<Record<string, any>>, required: true },
  label: { type: String, default: null },
  single: { type: Boolean, default: false },
  nested: { type: Boolean, default: true },
  // The id of the element that displays the errors, while there are errors:
  errorsElementId: { type: String, default: null }
} as const

export type FieldProps = Readonly<ExtractPropTypes<typeof fieldProps>>

export interface FieldEventHandlers {
  onFocus(): void
  onBlur(): void
  onInput(): void
  onChange(): void
}

export interface FieldOptions extends FocusOptions {
  // The handlers of the element's events, all of them by default:
  getEvents?: (
    handlers: FieldEventHandlers
  ) => Record<string, (...args: any[]) => any>
  // The services of components that own some, e.g. sources and buttons:
  services?: Services
  // Fields that render native inputs get their `name`, `title`, `readonly` and
  // `autofocus` attributes, text fields also `maxlength`, `placeholder` and
  // `autocomplete`. All others are disabled while they're `readonly`.
  nativeField?: boolean
  textField?: boolean
}

export function useField(
  props: FieldProps,
  {
    services,
    nativeField = false,
    textField = false,
    getEvents,
    focusElement,
    blurElement
  }: FieldOptions = {}
) {
  const schemaContext = useSchemaContext(props, {
    services,
    // The context holds the value that the component displays:
    getValue: () => value.value
  })
  const fieldValue = useValue(props, schemaContext)
  const { context } = schemaContext
  const { value } = fieldValue
  const { getSchemaValue } = useSchemaValue(context)
  const { componentPath } = useComponentPath(() => props.dataPath)

  const getBoolean = (key: string) =>
    computed(() => getSchemaValue(key, { type: Boolean, default: false }))

  const readonly = getBoolean('readonly')
  const disabled = getBoolean('disabled')
  const autofocus = getBoolean('autofocus')
  const clearable = computed(
    () => (
      getSchemaValue('clearable', { type: Boolean, default: false }) &&
      !readonly.value
    )
  )
  const placeholder = computed(() =>
    getSchemaValue('placeholder', { type: String })
  )
  const info = computed(() =>
    getSchemaValue('info', { type: String, default: null })
  )

  // Replace the validation errors of the field:
  const validate = () => {
    const errors = getValueValidationErrors(
      value.value,
      getValidations(props.schema, context)
    )
    schemaContext.services.dataContext!.model.setErrors(
      props.dataPath,
      errors.length > 0 ? errors : null
    )
    return errors.length === 0
  }

  const { emitEvent } = useSchemaEvents(() => props.schema, schemaContext)
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
          // Prevent endless `parseValue()` recursion:
          value:
            fieldValue.parsedValue.value !== undefined
              ? fieldValue.parsedValue.value
              : value.value
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
  const focus = useFocus(schemaContext.services, componentPath, {
    focusElement,
    blurElement
  })

  // The attributes and event handlers of the element that edits the value:
  const attributes = computed(() => {
    const attributes: Record<string, any> = {
      ...events.value,
      // Only text fields support `readonly`, disable all other components:
      'disabled': disabled.value || (readonly.value && !textField),
      // Link the displayed errors for assistive technology:
      'aria-invalid': !!props.errorsElementId || null,
      'aria-describedby': props.errorsElementId
    }
    if (nativeField) {
      attributes.name = props.dataPath
      if (props.label) {
        attributes.title = props.label
      }
      attributes.readonly = readonly.value
      attributes.autofocus = autofocus.value
      if (textField) {
        attributes.maxlength = getSchemaValue('maxLength', {
          type: Number
        })
        attributes.placeholder = placeholder.value
        attributes.autocomplete = getSchemaValue('autocomplete', {
          type: String
        })
      }
    }
    return attributes
  })

  const inputAffixesProps = computed(() =>
    getInputAffixesProps({
      schema: props.schema,
      disabled: disabled.value,
      clearable: clearable.value,
      value: value.value,
      label: props.label,
      info: info.value,
      context
    })
  )

  return {
    ...schemaContext,
    ...fieldValue,
    ...handlers,
    ...focus,
    focused,
    emitEvent,
    readonly,
    disabled,
    autofocus,
    clearable,
    placeholder,
    info,
    attributes,
    inputAffixesProps,

    componentPath,
    getSchemaValue,
    validate,

    clear() {
      value.value = null
      focus.blur()
      handlers.onChange()
    }
  }
}

export type Field = ReturnType<typeof useField>
