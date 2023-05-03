<template lang="pug">
button.dito-button(
  :id="dataPath"
  ref="element"
  :type="type"
  :title="title"
  :class="buttonClass"
  v-bind="attributes"
)
  .dito-button__text(
    v-if="text"
  ) {{ text }}
  .dito-info(
    v-if="!label && info"
    :data-info="info"
  )
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import { getSchemaAccessor } from '../utils/accessor.js'
import { hasResource } from '../utils/resource.js'
import { labelize } from '@ditojs/utils'

export default DitoTypeComponent.register(
  ['button', 'submit'],
  // @vue/component
  {
    defaultValue: () => undefined, // Callback to override `defaultValue: null`
    excludeValue: true,
    generateLabel: false,
    defaultWidth: 'auto',

    computed: {
      verb() {
        return this.verbs[this.name]
      },

      buttonClass() {
        return this.verb ? `dito-button-${this.verb}` : null
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

    height: calc(1em * var(--line-height));
  }
}
</style>
