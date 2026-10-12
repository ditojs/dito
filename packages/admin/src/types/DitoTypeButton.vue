<template lang="pug">
DitoButton(
  :id="componentPath"
  ref="element"
  :type="schema.type"
  :verb="verbs[schema.name]"
  :text="text"
  :title="text"
  :aria-busy="isRunning"
  v-bind="attributes"
)
  template(#prefix)
    DitoAffixes(
      v-if="prefixes.length > 0"
      :items="prefixes"
      position="prefix"
      :disabled="disabled"
      :parentContext="context"
    )
  template(#suffix)
    DitoAffixes(
      v-if="suffixes.length > 0"
      :items="suffixes"
      position="suffix"
      :disabled="disabled"
      :parentContext="context"
    )
    .dito-info(
      v-if="!label && info"
      :data-info="info"
    )
</template>

<script>
import { computed, getCurrentInstance, inject, ref } from 'vue'
import DitoComponent from '../DitoComponent.js'
import { defineType } from '../utils/schema/types.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import { useServices } from '../composables/useSchemaContext.ts'
import DitoAffixes from '../components/DitoAffixes.vue'
import { DitoButton } from '@ditojs/ui/src'
import { hasResource } from '../utils/resource.js'
import { asArray } from '@ditojs/utils'

// @vue/component
const DitoTypeButton = DitoComponent.component('DitoTypeButton', {
  components: { DitoAffixes, DitoButton },
  props: fieldProps,

  setup(props) {
    // Forms and sources submit through the button's component, see
    // `ResourceContext.submit()`:
    const component = getCurrentInstance().proxy
    const getSchemaComponent = inject('$schemaComponent')
    const isRunning = ref(false)
    const services = useServices({
      // Whether the action of the button is running, which handlers can end
      // early, e.g. before opening a dialog:
      get isRunning() {
        return isRunning.value
      },

      set isRunning(value) {
        isRunning.value = value
      },

      // Buttons of forms and lists with a resource submit their data:
      get submit() {
        const { resource } = services
        return resource
          ? options => resource.submit(component, options)
          : null
      }
    })
    const field = useField(props, {
      services,
      getEvents: ({ onFocus, onBlur }) => ({ onFocus, onBlur, onClick })
    })
    const { getSchemaValue, emitEvent } = field

    async function onClick() {
      // Prevent running the action again while it's running, e.g. submits.
      // The button isn't disabled meanwhile, as `disabled` reflects the
      // state of the schema, e.g. of forms that can't be submitted when
      // they're clean, which a running action doesn't change:
      if (isRunning.value) return
      isRunning.value = true
      // Write the edits that are held back first, e.g. debounced markup
      // edits, for the handlers to see them:
      services.container.model.writePendingValues()
      try {
        const res = await emitEvent('click', { parent: getSchemaComponent() })
        // Have buttons that define resources submit by default:
        if (
          res === undefined && // Meaning: don't prevent default.
          hasResource(props.schema)
        ) {
          await services.submit?.()
        }
      } catch (error) {
        const res = await emitEvent('error', { context: { error } })
        if (res === undefined) {
          const { admin } = services
          if (error instanceof AggregateError) {
            for (const err of error.errors) {
              admin.notify({ type: 'error', text: err })
            }
          } else {
            admin.notify({ type: 'error', text: error })
          }
        }
      } finally {
        isRunning.value = false
      }
    }

    return {
      context: field.context,
      createContext: field.createContext,
      isRunning,
      info: field.info,
      disabled: field.disabled,
      attributes: field.attributes,
      focus: field.focus,
      text: computed(() => getSchemaValue('text', { type: String })),
      prefixes: computed(() => asArray(props.schema.prefix)),
      suffixes: computed(() => asArray(props.schema.suffix)),
      closeForm: computed(() =>
        getSchemaValue('closeForm', { type: Boolean, default: false })
      )
    }
  }
})

const buttonDescriptor = {
  component: DitoTypeButton,
  defaultValue: () => undefined, // Callback to override `defaultValue: null`
  excludeValue: true,
  defaultWidth: 'auto',
  generateLabel: false,
  isButton: true
}

defineType({ ...buttonDescriptor, types: ['button'] })
defineType({ ...buttonDescriptor, types: ['submit'], submitsData: true })

export default DitoTypeButton
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-button {
  $self: &;

  &__text {
    @include ellipsis;
  }
}
</style>
