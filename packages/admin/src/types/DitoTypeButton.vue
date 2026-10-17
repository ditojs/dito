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
    DitoInfo(
      v-if="!label && info"
      :info="info"
    )
</template>

<script>
import { computed, ref } from 'vue'
import { defineType } from '../utils/schema/types.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import { getVerbs } from '../utils/services.ts'
import DitoAffixes from '../components/DitoAffixes.vue'
import DitoInfo from '../components/DitoInfo.vue'
import { DitoButton } from '@ditojs/ui/src'
import { hasResource } from '../utils/resource.js'
import { asArray } from '@ditojs/utils'

// @vue/component
const DitoTypeButton = {
  components: { DitoAffixes, DitoButton, DitoInfo },
  props: fieldProps,

  setup(props) {
    const isRunning = ref(false)
    const field = useField(props, {
      members: {
        // Handlers can end it early, like before opening a dialog:
        get isRunning() {
          return isRunning.value
        },

        set isRunning(value) {
          isRunning.value = value
        },

        // Buttons of sources submit through them, the others to their form,
        // which applies or saves its data:
        get submit() {
          const { sourceContext, routeContext } = services
          const target = sourceContext ?? (routeContext?.isForm && routeContext)
          return target ? options => target.submit(button, options) : null
        }
      },
      getEvents: ({ onFocus, onBlur }) => ({ onFocus, onBlur, onClick })
    })
    const { services, getSchemaValue, emitEvent } = field
    const closeForm = computed(() =>
      getSchemaValue('closeForm', { type: Boolean, default: false })
    )
    // The button that forms and sources submit through, see `SubmitButton`:
    const button = {
      get schema() {
        return props.schema
      },

      get closeForm() {
        return closeForm.value
      },

      context: field.context,
      createContext: field.createContext,
      getSchemaValue,
      emitEvent
    }

    async function onClick() {
      // Run once at a time. The button stays enabled, as `disabled` reflects
      // the state of the schema:
      if (!isRunning.value) {
        isRunning.value = true
        try {
          const res = await emitEvent('click', { bubble: true })
          // Have buttons that define resources submit by default:
          if (
            res === undefined && // Meaning: don't prevent default.
            hasResource(props.schema)
          ) {
            await services.submit?.()
          }
        } catch (error) {
          // Aborted requests, e.g. cancelled confirmations, end quietly:
          if (error?.name !== 'AbortError') {
            const context = field.createContext({ error })
            const res = await emitEvent('error', { context })
            if (res === undefined && !context.wasNotified) {
              services.adminContext.notify({ type: 'error', text: error })
            }
          }
        } finally {
          isRunning.value = false
        }
      }
    }

    return {
      ...field,
      verbs: computed(() => getVerbs(services)),
      isRunning,
      text: computed(() => getSchemaValue('text', { type: String })),
      prefixes: computed(() => asArray(props.schema.prefix)),
      suffixes: computed(() => asArray(props.schema.suffix))
    }
  }
}

const buttonTraits = {
  component: DitoTypeButton,
  defaultValue: undefined,
  defaultExclude: true,
  defaultWidth: 'auto',
  generatesLabel: false
}

defineType({ ...buttonTraits, type: 'button' })
defineType({ ...buttonTraits, type: 'submit', submitsData: true })

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
