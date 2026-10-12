import { computed, type PropType } from 'vue'
import { getSchemaValue } from '../utils/schema/data.js'
import {
  getValidations,
  getValueValidationErrors
} from '../utils/schema/validation.js'
import { getInputAffixesProps } from '../utils/affixes.js'
import {
  useSchemaContext,
  type SchemaContextProps
} from './useSchemaContext.ts'
import { useValue } from './useValue.ts'
import { useFocus, type FocusOptions } from './useFocus.ts'
import { useFieldEvents, type FieldEventsOptions } from './useFieldEvents.ts'
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
  // The id of the element that displays the errors, while there are errors,
  // see `DitoContainer`:
  errorsElementId: { type: String, default: null }
} as const

export interface FieldProps extends SchemaContextProps {
  readonly store: Record<string, any>
  readonly label: string | null
  readonly single: boolean
  readonly errorsElementId: string | null
}

export interface FieldOptions
  extends FocusOptions,
    Pick<FieldEventsOptions, 'getEvents'> {
  // The services of components that own some, e.g. sources and buttons:
  services?: Services
  // Fields that render native inputs get their `name`, `title`, `readonly` and
  // `autofocus` attributes, text fields also `maxlength`, `placeholder` and
  // `autocomplete`. All others are disabled while they're `readonly`.
  nativeField?: boolean
  textField?: boolean
}

// The value of a type component and the behaviour of its field: its settings,
// attributes, events and focus, and its validation.
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
  const { context, createContext } = schemaContext
  const { value } = fieldValue

  // Read `keyOrDataPath` from the schema, resolving callbacks with the
  // component's context, see `getSchemaValue()` in `utils/schema/data.js`:
  const getFieldSchemaValue = (
    keyOrDataPath: string | string[],
    options = {}
  ) =>
    getSchemaValue(keyOrDataPath, {
      ...options,
      schema: props.schema,
      context
    })

  const getBoolean = (key: string) =>
    computed(() => getFieldSchemaValue(key, { type: Boolean, default: false }))

  const readonly = getBoolean('readonly')
  const disabled = getBoolean('disabled')
  const autofocus = getBoolean('autofocus')
  const clearable = computed(
    () => (
      getFieldSchemaValue('clearable', { type: Boolean, default: false }) &&
      !readonly.value
    )
  )
  const placeholder = computed(() =>
    getFieldSchemaValue('placeholder', { type: String })
  )
  const info = computed(() =>
    getFieldSchemaValue('info', { type: String, default: null })
  )

  // Validate the value and replace the validation errors of the field, see
  // `DataModel.setErrors()`. Return whether the value is valid:
  const validate = () => {
    const errors = getValueValidationErrors(
      value.value,
      getValidations(props.schema, context)
    )
    schemaContext.services.container!.model.setErrors(
      props.dataPath,
      errors.length > 0 ? errors : null
    )
    return errors.length === 0
  }

  const { events, ...fieldEvents } = useFieldEvents(props, {
    createContext,
    ...fieldValue,
    getEvents,
    validate
  })
  const focus = useFocus(schemaContext.services, { focusElement, blurElement })

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
        attributes.maxlength = getFieldSchemaValue('maxLength', {
          type: Number
        })
        attributes.placeholder = placeholder.value
        attributes.autocomplete = getFieldSchemaValue('autocomplete', {
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
    ...fieldEvents,
    ...focus,
    readonly,
    disabled,
    autofocus,
    clearable,
    placeholder,
    info,
    attributes,
    inputAffixesProps,

    getSchemaValue: getFieldSchemaValue,
    validate,

    clear() {
      value.value = null
      focus.blur()
      fieldEvents.onChange()
    }
  }
}

export type Field = ReturnType<typeof useField>
