<template lang="pug">
  form.dito-dialog(@submit.prevent="")
    dito-schema.dito-scroll(
      ref="schema"
      :schema="schema"
      :data="data"
    )
      dito-buttons.dito-form-buttons(
        slot="buttons"
        :buttons="namedButtons"
        :data="data"
        :params="buttonParams"
      )
</template>

<style lang="sass">
.dito
  .v--modal-overlay
    z-index: 2000
</style>

<script>
import DitoComponent from '@/DitoComponent'

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

    namedButtons() {
      return this.getNamedSchemas(
        this.buttons,
        { type: 'button' } // Defaults
      )
    },

    buttonParams() {
      // Additional parameters to be passed to button events:
      return { dialog: this }
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

    close() {
      this.$modal.hide(this.name)
    },

    resolve(value) {
      this.promise.resolve(value)
      this.close()
    },

    reject(value) {
      this.promise.reject(value)
      this.close()
    }
  }
})
</script>
