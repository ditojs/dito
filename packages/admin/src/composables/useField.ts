import { computed, type ExtractPropTypes, type PropType } from 'vue'
import {
  getValidations,
  getValueValidationErrors
} from '../utils/schema/validation.js'
import { getInputAffixesProps } from '../utils/affixes.js'
import { useSchemaContext } from './useSchemaContext.ts'
import { useValue } from './useValue.ts'
import { useSchemaValue } from './useSchemaValue.ts'
import { useComponentPath } from './useComponentPath.ts'
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
  // The id of the element that displays the errors, while there are errors:
  errorsElementId: { type: String, default: null }
} as const

export type FieldProps = Readonly<ExtractPropTypes<typeof fieldProps>>

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

  const { events, ...fieldEvents } = useFieldEvents(props, {
    ...schemaContext,
    ...fieldValue,
    getEvents,
    validate
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

    componentPath,
    getSchemaValue,
    validate,

    clear() {
      value.value = null
      focus.blur()
      fieldEvents.onChange()
    }
  }
}

export type Field = ReturnType<typeof useField>
