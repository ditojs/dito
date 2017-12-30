<template lang="pug">
  toggle-button.dito-switch(
    :id="name"
    :name="name"
    :sync="true"
    :cssColors="true"
    :labels="schema.labels"
    :width="width"
    :height="height"
    :title="label"
    v-model="value"
    v-validate="validations"
    :data-vv-as="label"
    :disabled="disabled"
  )
</template>

<style lang="sass">
  .dito-switch
    .v-switch-core
      background-color: $color-light
    &.toggled
      .v-switch-core
        background-color: $color-active
    .v-switch-label
      text-transform: uppercase
</style>

<script>
import TypeComponent from '@/TypeComponent'

export default TypeComponent.register('switch', {
  computed: {
    width() {
      return this.schema.size?.width || 50
    },

    height() {
      return this.schema.size?.height || 22
    }
  }
})
</script>
