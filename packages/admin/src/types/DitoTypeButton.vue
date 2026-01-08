<template lang="pug">
DitoButton.dito-button(
  :id="dataPath"
  ref="element"
  :type="type"
  :text="text"
  :title="title"
  :class="buttonClass"
  v-bind="attributes"
)
  template(#prefix)
    DitoAffixes(
      v-if="prefixes.length > 0"
      :items="prefixes"
      :parentContext="context"
    )
  template(#suffix)
    DitoAffixes(
      v-if="suffixes.length > 0"
      :items="suffixes"
      :parentContext="context"
    )
    .dito-info(
      v-if="!label && info"
      :data-info="info"
    )
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import DitoAffixes from '../components/DitoAffixes.vue'
import { DitoButton } from '@ditojs/ui/src'
import { getSchemaAccessor } from '../utils/accessor.js'
import { hasResource } from '../utils/resource.js'
import { labelize, asArray } from '@ditojs/utils'

export default DitoTypeComponent.register(
  ['button', 'submit'],
  // @vue/component
  {
    components: { DitoAffixes, DitoButton },
    defaultValue: () => undefined, // Callback to override `defaultValue: null`
    excludeValue: true,
    defaultWidth: 'auto',
    generateLabel: false,

    data() {
      return {
        isRunning: false
      }
    },

    computed: {
      verb() {
        return this.verbs[this.name]
      },

      buttonClass() {
        return this.verb ? `dito-button--${this.verb}` : null
      },

      text: getSchemaAccessor('text', {
        type: String
      }),

      title() {
        return this.text || labelize(this.verb)
      },

      info: getSchemaAccessor('info', {
        type: String,
        default: null
      }),

      prefixes() {
        return asArray(this.schema.prefix)
      },

      suffixes() {
        return asArray(this.schema.suffix)
      },

      closeForm: getSchemaAccessor('closeForm', {
        type: Boolean,
        default: false
      })
    },

    methods: {
      // @override
      getEvents() {
        const { onFocus, onBlur, onClick } = this
        return { onFocus, onBlur, onClick }
      },

      async submit(options) {
        return this.resourceComponent?.submit(this, options)
      },

      async onClick() {
        this.isRunning = true
        try {
          const res = await this.emitEvent('click', {
            parent: this.schemaComponent
          })
          // Have buttons that define resources call `this.submit()` by default:
          if (
            res === undefined && // Meaning: don't prevent default.
            hasResource(this.schema)
          ) {
            await this.submit()
          }
        } catch (error) {
          const res = await this.emitEvent('error', { error })
          if (res === undefined) {
            if (error instanceof AggregateError) {
              for (const err of error.errors) {
                this.notify({ type: 'error', text: err })
              }
            } else {
              this.notify({ type: 'error', text: error })
            }
          }
        } finally {
          this.isRunning = false
        }
      }
    }
  }
)
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
