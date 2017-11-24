<template lang="pug">
  toggle-button.dito-switch(
    :id="name"
    :name="name"
    :sync="true"
    :color="{ checked: 'inherit', unchecked: 'inherit' }"
    :labels="schema.labels"
    :width="width"
    :height="height"
    :title="label"
    v-model="value"
    v-validate="validations"
    :disabled="disabled"
  )
</template>

<style lang="sass">
  .dito-switch
    // TODO: Remove need for !imporrtant:
    // https://github.com/euvl/vue-js-toggle-button/issues/36
    .v-switch-core
      background-color: $color-light !important
    &.toggled
      .v-switch-core
        background-color: $color-active !important
    .v-switch-label
      text-transform: uppercase
</style>

<script>
import TypeComponent from '@/TypeComponent'

export default TypeComponent.register('switch', {
  computed: {
    // TODO: Remove once PR #38 is released:
    // https://github.com/euvl/vue-js-toggle-button/pull/38
    value: {
      get() {
        return !!this.data[this.name]
      },
      set(value) {
        this.data[this.name] = value
      }
    },

    width() {
      const { size } = this.schema
      return size && size.width || 50
    },

    height() {
      const { size } = this.schema
      return size && size.height || 22
    }
  }
})
</script>
