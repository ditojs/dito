<template lang="pug">
  form.dito-dialog(@submit.prevent="")
    dito-schema.dito-scroll(
      ref="schema"
      :schema="schema"
      :data="data"
      :meta="meta"
    )
      dito-buttons.dito-form-buttons(
        slot="buttons"
        :buttons="buttonSchemas"
        :data="data"
        :meta="meta"
      )
</template>

<style lang="sass">
.dito
  .v--modal-overlay
    z-index: 2000
</style>

<script>
import DitoComponent from '@/DitoComponent'
import { getButtonSchemas } from '@/utils/schema'

// @vue/component
export default DitoComponent.component('dito-dialog', {
  props: {
    components: { type: Object, required: true },
    buttons: { type: Object, required: true },
    promise: { type: Object, required: true },
    data: { type: Object, default: () => ({}) }
  },

  computed: {
    name() {
      return this.$parent.name
    },

    schema() {
      return {
        components: this.components
      }
    },

    buttonSchemas() {
      return getButtonSchemas(this.buttons)
    },

    meta() {
      return {
        // Additional parameters to be passed to all events:
        params: { dialogComponent: this }
      }
    }
  },

  created() {
    // Make sure data contains all the expected keys
    for (const key in this.components) {
      if (!(key in this.data)) {
        this.data[key] = null
      }
    }
  },

  methods: {
    onClick(button) {
      button.onClick?.(this)
    },

    hide() {
      this.$modal.hide(this.name)
    },

    resolve(value) {
      this.promise.resolve(value)
      this.hide()
    },

    reject(value) {
      this.promise.reject(value)
      this.hide()
    },

    accept() {
      this.resolve(this.data)
    },

    cancel() {
      this.resolve(null)
    }
  }
})
</script>
