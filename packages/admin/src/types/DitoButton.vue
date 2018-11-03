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
import DitoTypeComponent from '@/DitoTypeComponent'

// @vue/component
export default DitoTypeComponent.register(['button', 'submit'], {
  defaultValue: undefined,

  props: {
    params: { type: Object, default: null }
  },

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
        params: this.params,
        parent: this.schemaComponent
      })
    }
  }
})
</script>
