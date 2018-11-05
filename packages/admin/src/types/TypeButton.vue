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
      this.emitEvent('click', {
        params: this.meta.params,
        parent: this.schemaComponent
      })
    }
  }
})
</script>
