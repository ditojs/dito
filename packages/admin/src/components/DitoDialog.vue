<template lang="pug">
  form.dito-dialog(@submit.prevent="")
    dito-schema.dito-scroll(
      :schema="schema"
      :data="data"
      :meta="meta"
    )
      dito-buttons.dito-buttons-large(
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
import { addEvents } from '@ditojs/ui'

// @vue/component
export default DitoComponent.component('dito-dialog', {
  props: {
    components: { type: Object, required: true },
    buttons: { type: Object, required: true },
    promise: { type: Object, required: true },
    data: { type: Object, default: () => ({}) }
  },

  data() {
    return {
      windowEvents: null
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
    },

    buttonSchemas() {
      return Object.entries(getButtonSchemas(this.buttons)).reduce(
        // Process the button schemas to add default click events
        // for both 'submit' and 'cancel' buttons:
        (schemas, [key, schema]) => {
          const { type, events } = schema
          if (!events) {
            const click = type === 'submit' ? () => this.accept()
              : key === 'cancel' ? () => this.cancel()
              : null
            if (click) {
              schema = {
                ...schema,
                events: { click }
              }
            }
          }
          schemas[key] = schema
          return schemas
        },
        {}
      )
    },

    hasCancel() {
      return Object.keys(this.buttonSchemas).includes('cancel')
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

  mounted() {
    this.windowEvents = addEvents(window, {
      keyup: () => {
        if (event.keyCode === 27) {
          this.cancel()
        }
      }
    })
  },

  destroyed() {
    this.windowEvents.remove()
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

    accept(data = this.data) {
      this.resolve(data)
    },

    cancel() {
      if (this.hasCancel) {
        this.resolve(null)
      }
    }
  }
})
</script>
