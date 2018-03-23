<template lang="pug">
  form.dito-dialog(@submit.prevent="")
    dito-schema(
      :schema="schema"
      dataPath=""
      :data="data"
      :meta="{}"
      :store="{}"
      :disabled="false"
      :generateLabels="true"
    )
      .dito-buttons.dito-buttons-form(slot="buttons")
        button.dito-button(
          v-for="(button, key) in buttons"
          :type="button.type || 'button'"
          @click="onClick(button)"
        ) {{ getLabel(button, key) }}
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-dialog', {
  props: {
    components: Object,
    buttons: Object,
    data: { type: Object, default: () => {} }
  },

  created() {
    for (const key in this.components) {
      if (!(key in this.data)) {
        this.data[key] = null
      }
    }
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

  methods: {
    onClick(button) {
      button.onClick?.(this)
    },

    close() {
      this.$modal.hide(this.name)
    }
  }
})
</script>
