<template lang="pug">
  form.dito-dialog(@submit.prevent="")
    dito-schema.dito-scroll(
      :schema="schema"
      :data="data"
      :meta="{}"
      :store="{}"
      :disabled="false"
      :generateLabels="true"
    )
      .dito-buttons.dito-form-buttons(slot="buttons")
        button.dito-button(
          v-for="(button, key) in buttons"
          :type="button.type || 'button'"
          @click="onClick(button)"
        ) {{ getLabel(button, key) }}
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
    data: { type: Object, default: () => {} }
  },

  computed: {
    name() {
      return this.$parent.name
    },

    schema() {
      return {
        components: this.components
      }
    }
  },

  created() {
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
