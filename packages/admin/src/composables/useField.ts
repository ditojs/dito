import {
  computed,
  onBeforeUnmount,
  ref,
  shallowReactive,
  type ExtractPropTypes,
  type PropType
} from 'vue'
import { camelize } from '@ditojs/utils'
import { getInputAffixesProps } from '../utils/affixes.js'
import { getSchemaEventEntries } from '../utils/schema/events.js'
import { isLabelled } from '../utils/schema/structure.js'
import { appendDataPath } from '../utils/data.js'
import { getText } from '../utils/html.js'
import { getDefaultValue, getEmptyValue } from '../utils/schema/data.js'
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
  errorsElementId: { type: String, default: null },
  // The id of the label, if it shows buttons of the component:
  labelId: { type: String, default: null }
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
  // Fields that render native inputs get their `name`, `title`, `readonly` and
  // `autofocus` attributes, text fields also `maxlength`, `placeholder` and
  // `autocomplete`. All others are disabled while they're `readonly`.
  nativeField?: boolean
  textField?: boolean
}

// The field of a container: the value of its type component and the schema
// values that both show, evaluated once with the members of the component:
export function useContainerField(
  props: SchemaContextProps & {
    readonly disabled: boolean
    readonly generateLabels: boolean
  }
) {
  // The members that the type component adds to the contexts of its field,
  // like the `options` of selects. They override the services that the
  // contexts inherit from:
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
  const label = computed(() =>
    isLabelled(props.schema, props.generateLabels)
      ? getLabel(props.schema)
      : null
  )
  // Add the name, also of unnested components. The display content of widgets
  // has none:
  const { componentPath, parentComponentPath } = useComponentPath(
    () => props.dataPath,
    parent => {
      const { name } = props.schema
      return name ? appendDataPath(parent.path, name) : parent.path
    }
  )

  return {
    ...schemaContext,
    // Add members while the type component that calls it is mounted:
    addMembers(owner: object) {
      members.add(owner)
      onBeforeUnmount(() => members.delete(owner))
    },
    value,
    parsedValue,
    componentPath,
    parentComponentPath,
    getSchemaValue,
    label,
    labelText: computed(() => getText(label.value)),
    info: computed(() =>
      getSchemaValue('info', { type: [String, Object], default: null })
    ),
    placeholder: computed(() =>
      getSchemaValue('placeholder', { type: String })
    ),
    readonly: computed(() =>
      getSchemaValue('readonly', { type: Boolean, default: false })
    ),
    // Components are disabled along with the schema around them:
    disabled: computed(
      () => (
        props.disabled ||
        getSchemaValue('disabled', { type: Boolean, default: false })
      )
    )
  }
}

export type ContainerField = ReturnType<typeof useContainerField>

// Edit the field of the container in the element of the type component:
export function useField(
  props: FieldProps,
  {
    nativeField = false,
    textField = false,
    getEvents,
    focusElement,
    blurElement
  }: FieldOptions = {}
) {
  const { field } = props
  const {
    context,
    services,
    componentPath,
    getSchemaValue,
    label,
    labelText,
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

  // Replace the validation errors of the value, with the checks of all fields
  // that edit it:
  const validate = () => services.dataContext!.model.validate(props.dataPath)

  const { emitEvent } = useSchemaEvents(() => props.schema, field)
  const focused = ref(false)

  // Edits emit `input` when they change the value, and `change` when they're
  // done. Edits that don't write the value, e.g. of lists, emit both at once:
  let hasEmittedInput = false
  // Only validate fields on blur that were edited while focused, not the
  // ones that the user merely passes through:
  let isEdited = false
  const value = computed({
    get: () => field.value.value,
    set(newValue) {
      field.value.value = newValue
      hasEmittedInput = true
      if (focused.value) {
        isEdited = true
      }
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
      if (isEdited) {
        isEdited = false
        validate()
      }
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
      if (labelText.value) {
        attributes.title = labelText.value
      }
      attributes.readonly = readonly.value
      attributes.autofocus = autofocus.value
      attributes['aria-labelledby'] = getSchemaValue('labelledBy', {
        type: String
      })
      if (textField) {
        attributes.maxlength = getSchemaValue('maxLength', {
          type: Number
        })
        attributes.placeholder = placeholder.value
        const autocomplete = getSchemaValue('autocomplete', { type: String })
        attributes.autocomplete = autocomplete
        // Keep password managers out of fields that aren't about logins:
        if (!isCredentialAutocomplete(autocomplete)) {
          Object.assign(attributes, passwordManagerIgnoreAttributes)
        }
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
    labelText,
    info,
    attributes,
    inputAffixesProps,

    componentPath,
    getSchemaValue,
    validate,

    clear() {
      // Fields with `nullable: false` clear to their default:
      const { schema } = props
      value.value =
        schema.nullable === false
          ? getDefaultValue(schema, context)
          : getEmptyValue(schema, context)
      focus.blur()
      handlers.onChange()
    }
  }
}

export type Field = ReturnType<typeof useField>

// Password managers ignore `autocomplete="off"`, but each reads an attribute of
// its own: 1Password, LastPass, Bitwarden and Dashlane:
const passwordManagerIgnoreAttributes = {
  'data-1p-ignore': '',
  'data-lpignore': 'true',
  'data-bwignore': '',
  'data-form-type': 'other'
}

// The `autocomplete` tokens of the fields that password managers fill in:
const credentialTokens = new Set([
  'username',
  'current-password',
  'new-password',
  'one-time-code',
  'webauthn'
])

function isCredentialAutocomplete(autocomplete?: string) {
  return !!autocomplete?.split(/\s+/).some(token => credentialTokens.has(token))
}
