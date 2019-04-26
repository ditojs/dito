<template lang="pug">
  button.dito-button(
    ref="element"
    :id="dataPath"
    :type="type"
    :title="schema.text || labelize(verb)"
    :class="`dito-button-${verb}`"
    v-bind="attributes"
    v-on="listeners"
  ) {{ schema.text }}
</template>

<script>
import TypeComponent from '@/TypeComponent'

export default TypeComponent.register([
  'button', 'submit'
],
// @vue/component
{
  defaultValue: undefined,
  // TODO: Consider making this work nicely:
  // preventFlexGrowth: true,

  computed: {
    verb() {
      return this.verbs[this.name] || this.name
    },

    listeners() {
      return {
        focus: () => this.onFocus(),
        blur: () => this.onBlur(),
        click: () => this.onClick()
      }
    }
  },

  methods: {
    onClick() {
      const { params } = this.meta
      this.emitEvent('click', {
        // Provide a params function that creates a copy of the params when
        // needed, since they will be directly used as the item params object,
        // see `getItemParams()`:
        params: params ? () => ({ ...params }) : null,
        parent: this.schemaComponent
      })
    },

    async submit(options) {
      return this.resourceComponent.submit(this, options)
    }
  }
})
</script>
