import {
  computed,
  onBeforeUnmount,
  ref,
  shallowReactive,
  type ExtractPropTypes,
  type PropType
} from 'vue'
import { camelize } from '@ditojs/utils'
import {
  getValidations,
  getValueValidationErrors
} from '../utils/schema/validation.js'
import { getInputAffixesProps } from '../utils/affixes.js'
import { getSchemaEventEntries } from '../utils/schema/events.js'
import { isLabelled } from '../utils/schema/structure.js'
import { appendDataPath } from '../utils/data.js'
import { getMultipleValue } from '../utils/schema/data.js'
import {
  useSchemaContext,
  useServices,
  type SchemaContextProps
} from './useSchemaContext.ts'
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
  field: { type: Object as PropType<ContainerField>, required: true },
  single: { type: Boolean, default: false },
  nested: { type: Boolean, default: true },
  // The id of the element that displays the errors, while there are errors:
  errorsElementId: { type: String, default: null }
} as const

export type FieldProps = Readonly<ExtractPropTypes<typeof fieldProps>>

export interface FieldEventHandlers {
  onFocus(): void
  onBlur(): void
  onChange(): void
}

export interface FieldOptions extends FocusOptions {
  // The handlers of the element's events, all of them by default:
  getEvents?: (
    handlers: FieldEventHandlers
  ) => Record<string, (...args: any[]) => any>
  // The members that the component adds to the contexts of its field, e.g. the
  // `options` of selects:
  members?: object
  // Fields that render native inputs get their `name`, `title`, `readonly` and
  // `autofocus` attributes, text fields also `maxlength`, `placeholder` and
  // `autocomplete`. All others are disabled while they're `readonly`.
  nativeField?: boolean
  textField?: boolean
}

// The field of a container: the value of its type component and the schema
// values that both show, evaluated once with the members of the component:
export function useContainerField(
  props: SchemaContextProps & { readonly generateLabels: boolean }
) {
  // The members that the type component adds, see `useField()`. They override
  // the services that the contexts inherit from:
  const members = shallowReactive(new Set<object>())
  const getOwner = (target: Services, key: PropertyKey) => (
    [...members].find(owner => key in owner) ?? target
  )
  const services = new Proxy(useServices(), {
    has: (target, key) => key in getOwner(target, key),
    get: (target, key) => Reflect.get(getOwner(target, key), key),
    set: (target, key, value) => Reflect.set(getOwner(target, key), key, value)
  })
  const schemaContext = useSchemaContext(props, {
    services,
    // The context holds the value that the component displays:
    getValue: () => value.value
  })
  const { context } = schemaContext
  const { value, parsedValue } = useValue(props, schemaContext)
  const { getSchemaValue, getLabel } = useSchemaValue(context)
  // Add the name, also of unnested components:
  const { componentPath, parentComponentPath } = useComponentPath(
    () => props.dataPath,
    parent => appendDataPath(parent.path, props.schema.name)
  )

  const getBoolean = (key: string) =>
    computed(() => getSchemaValue(key, { type: Boolean, default: false }))

  return {
    ...schemaContext,
    members,
    value,
    parsedValue,
    componentPath,
    parentComponentPath,
    getSchemaValue,
    label: computed(() =>
      isLabelled(props.schema, props.generateLabels)
        ? getLabel(props.schema)
        : null
    ),
    info: computed(() =>
      getSchemaValue('info', { type: String, default: null })
    ),
    placeholder: computed(() =>
      getSchemaValue('placeholder', { type: String })
    ),
    readonly: getBoolean('readonly'),
    disabled: getBoolean('disabled')
  }
}

export type ContainerField = ReturnType<typeof useContainerField>

// Edit the field of the container in the element of the type component:
export function useField(
  props: FieldProps,
  {
    members,
    nativeField = false,
    textField = false,
    getEvents,
    focusElement,
    blurElement
  }: FieldOptions = {}
) {
  const { field } = props
  if (members) {
    field.members.add(members)
    onBeforeUnmount(() => field.members.delete(members))
  }
  const {
    context,
    services,
    componentPath,
    getSchemaValue,
    label,
    info,
    placeholder,
    readonly,
    disabled,
    parsedValue
  } = field

  const autofocus = computed(() =>
    getSchemaValue('autofocus', { type: Boolean, default: false })
  )
  const clearable = computed(
    () => (
      getSchemaValue('clearable', { type: Boolean, default: false }) &&
      !readonly.value
    )
  )

  // Replace the validation errors of the field:
  const validate = () => {
    const errors = getValueValidationErrors(
      value.value,
      getValidations(context)
    )
    services.dataContext!.model.setErrors(
      props.dataPath,
      errors.length > 0 ? errors : null
    )
    return errors.length === 0
  }

  const { emitEvent } = useSchemaEvents(() => props.schema, field)
  const focused = ref(false)

  // Edits emit `input` when they change the value, and `change` when they're
  // done. Edits that don't write the value, e.g. of lists, emit both at once:
  let hasEmittedInput = false
  const value = computed({
    get: () => field.value.value,
    set(newValue) {
      field.value.value = newValue
      hasEmittedInput = true
      emitEvent('input')
    }
  })

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

    onChange() {
      if (!hasEmittedInput) {
        emitEvent('input')
      }
      hasEmittedInput = false
      emitEvent('change', {
        context: {
          // Prevent endless `parseValue()` recursion:
          value:
            parsedValue.value !== undefined ? parsedValue.value : value.value
        }
      })
    }
  }

  // Schema events that the component doesn't handle are native events, but
  // not `input` and `change`, which its edits emit:
  const events = computed(() => {
    const events = getEvents ? getEvents(handlers) : { ...handlers }
    for (const { event } of getSchemaEventEntries(props.schema)) {
      if (event !== 'input' && event !== 'change') {
        events[`on${camelize(event, true)}`] ??= () => emitEvent(event)
      }
    }
    return events
  })
  const focus = useFocus(services, componentPath, {
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
      if (label.value) {
        attributes.title = label.value
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
      label: label.value,
      info: info.value,
      context
    })
  )

  return {
    context,
    createContext: field.createContext,
    services,
    value,
    ...handlers,
    ...focus,
    focused,
    emitEvent,
    readonly,
    disabled,
    autofocus,
    clearable,
    placeholder,
    label,
    info,
    attributes,
    inputAffixesProps,

    componentPath,
    getSchemaValue,
    validate,

    clear() {
      // Multiple values are never `null`:
      value.value = getMultipleValue(props.schema, context) ? [] : null
      focus.blur()
      handlers.onChange()
    }
  }
}

export type Field = ReturnType<typeof useField>
