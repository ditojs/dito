import {
  computed,
  h,
  inject,
  onBeforeUnmount,
  provide,
  unref,
  watch
} from 'vue'
import { camelize, parseDataPath } from '@ditojs/utils'
import SchemaContext from './SchemaContext.js'
import DitoContainer from './components/DitoContainer.vue'
import { useComponentPath } from './composables/useComponentPath.ts'
import { useServices } from './composables/useSchemaContext.ts'
import { useStore } from './composables/useStore.ts'
import { getRootData } from './utils/services.ts'
import { appendDataPath } from './utils/data.js'
import { shouldRenderSchema } from './utils/schema/data.js'
import { getComponentEntry } from './utils/schema/lookup.js'
import { isInlined } from './utils/schema/structure.js'
import { getItemAdapter, getSourceType } from './utils/schema/types.ts'
import {
  fieldRegistryKey,
  layoutKey,
  sourceSchemaKey
} from './utils/keys.ts'

// The component of a field of `type` in the template of a form: It registers
// the schema that its attributes describe in the form, at its `path`, and
// renders it as the form's pane would render it.
export function defineFieldComponent(type) {
  return {
    name: `Dito${camelize(type, true)}Field`,
    inheritAttrs: false,

    props: {
      path: { type: String, required: true }
    },

    setup(props, { attrs, slots }) {
      const registry = inject(fieldRegistryKey, null)
      const layout = inject(layoutKey, null)
      if (!registry || !layout) {
        throw new Error(
          `Unable to place field '${props.path}' outside of template forms.`
        )
      }
      const services = useServices()
      const sourceSchema = inject(sourceSchemaKey, null)
      const options = computed(() => getSchemaOptions(attrs))
      // The default slot of sources is the form of their items, whose fields
      // register in it, and the content of custom components in other types:
      const items =
        getSourceType(type) && slots.default
          ? registry.createItemRegistry()
          : null
      if (items) {
        if (!options.value.inlined) {
          throw new Error(
            `Unsupported item form in field '${props.path}': Use 'inlined'.`
          )
        }
        provide(fieldRegistryKey, items)
      }
      const getSource = () => ({
        ...options.value,
        type,
        ...(items && { form: items.schema })
      })
      let field = null
      watch(
        () => props.path,
        path => {
          field?.unregister()
          field = registry.register(path, getSource, {
            getParentDataPath: () => layout.props.dataPath,
            items
          })
        },
        { immediate: true }
      )
      onBeforeUnmount(() => field.unregister())

      // Fields render once they're part of the schema of the form, and inside
      // the groups of dotted paths, e.g. 'address.city':
      const entry = computed(() => {
        const source = unref(sourceSchema)
        const itemAdapter =
          source && isInlined(source) ? getItemAdapter(source) : null
        let { schema, data, dataPath, store } = layout.props
        let entry = null
        for (const name of parseDataPath(props.path)) {
          const component = schema.components?.[name]
          if (!component || !data) {
            return null
          }
          entry = {
            ...getComponentEntry(component, name, {
              dataPath,
              itemAdapter: entry ? null : itemAdapter,
              store: useStore({ store }).getChildStore(name)
            }),
            data
          }
          // Groups hold the data of their fields:
          schema = entry.schema
          dataPath = entry.dataPath
          store = entry.store
          data = data[name]
        }
        const context = SchemaContext.createForSchema(services, {
          ...entry,
          name: entry.schema.name,
          rootData: getRootData(services)
        })
        return shouldRenderSchema(entry.schema, context) ? entry : null
      })

      // Fields continue the component path of the pane, with their groups:
      useComponentPath(
        () => entry.value?.itemDataPath ?? layout.props.dataPath,
        () =>
          parseDataPath(props.path)
            .slice(0, -1)
            .reduce(appendDataPath, layout.componentPath.value)
      )

      return () => {
        const { disabled, compact, generateLabels } = layout.props
        return entry.value
          ? h(
              DitoContainer,
              {
                schema: entry.value.schema,
                dataPath: entry.value.dataPath,
                data: entry.value.data,
                itemDataPath: entry.value.itemDataPath,
                store: entry.value.store,
                nested: entry.value.nested,
                disabled,
                compact,
                generateLabels,
                class: attrs.class,
                style: attrs.style
              },
              slots.default && { default: slots.default }
            )
          : null
      }
    }
  }
}

// The attributes are the options of the schema, with bare attributes as `true`,
// as in Vue's boolean props, e.g. `<DitoTextField path="name" required />`:
function getSchemaOptions(attrs) {
  return Object.fromEntries(
    Object.entries(attrs)
      .filter(([key]) => key !== 'class' && key !== 'style')
      .map(([key, value]) => [camelize(key), value === '' ? true : value])
  )
}

// The fields of the built-in types that hold or edit values:
export const DitoButtonField = defineFieldComponent('button')
export const DitoCheckboxField = defineFieldComponent('checkbox')
export const DitoCheckboxesField = defineFieldComponent('checkboxes')
export const DitoCodeField = defineFieldComponent('code')
export const DitoColorField = defineFieldComponent('color')
export const DitoComponentField = defineFieldComponent('component')
export const DitoCreditcardField = defineFieldComponent('creditcard')
export const DitoDateField = defineFieldComponent('date')
export const DitoDatetimeField = defineFieldComponent('datetime')
export const DitoDomainField = defineFieldComponent('domain')
export const DitoEmailField = defineFieldComponent('email')
export const DitoHostnameField = defineFieldComponent('hostname')
export const DitoIntegerField = defineFieldComponent('integer')
export const DitoListField = defineFieldComponent('list')
export const DitoMarkupField = defineFieldComponent('markup')
export const DitoMultiselectField = defineFieldComponent('multiselect')
export const DitoNumberField = defineFieldComponent('number')
export const DitoObjectField = defineFieldComponent('object')
export const DitoPasswordField = defineFieldComponent('password')
export const DitoRadioField = defineFieldComponent('radio')
export const DitoSelectField = defineFieldComponent('select')
export const DitoSliderField = defineFieldComponent('slider')
export const DitoSubmitField = defineFieldComponent('submit')
export const DitoSwitchField = defineFieldComponent('switch')
export const DitoTelField = defineFieldComponent('tel')
export const DitoTextField = defineFieldComponent('text')
export const DitoTextareaField = defineFieldComponent('textarea')
export const DitoTimeField = defineFieldComponent('time')
export const DitoUploadField = defineFieldComponent('upload')
export const DitoUrlField = defineFieldComponent('url')
export const DitoValueField = defineFieldComponent('value')
