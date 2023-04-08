<template lang="pug">
button.dito-button(
  :id="dataPath"
  ref="element"
  :type="type"
  :title="text"
  :class="`dito-button-${verb}`"
  v-bind="attributes"
) {{ text }}
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
    defaultWidth: 'auto',
    // TODO: Consider making this work nicely:
    // omitFlexGrow: true,

    computed: {
      verb() {
        return this.verbs[this.name] || this.name
      },

      text: getSchemaAccessor('text', {
        type: String,
        get(text) {
          return text || labelize(this.verb)
        }
      }),

      closeForm: getSchemaAccessor('closeForm', {
        type: Boolean,
        default: false
      }),

      // @override
      events() {
        const { onFocus, onBlur, onClick } = this
        return { onFocus, onBlur, onClick }
      }
    },

    methods: {
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
