<template lang="pug">
  form.dito-dialog(@submit.prevent="")
    dito-schema.dito-scroll(
      :schema="schema"
      :data="dialogData"
    )
      dito-buttons.dito-buttons-large(
        slot="buttons"
        :buttons="buttonSchemas"
        :data="dialogData"
      )
</template>

<style lang="sass">
  .v--modal-overlay
    z-index: 2000
</style>

<script>
import { clone } from '@ditojs/utils'
import { addEvents } from '@ditojs/ui'
import DitoComponent from '../DitoComponent.js'
import { getButtonSchemas } from '../utils/schema.js'

// @vue/component
export default DitoComponent.component('dito-dialog', {
  provide() {
    return {
      $dialogComponent: () => this
    }
  },

  props: {
    components: { type: Object, required: true },
    buttons: { type: Object, required: true },
    promise: { type: Object, required: true },
    data: { type: Object, default: () => ({}) }
  },

  data() {
    // Make sure dialog data contains all the expected keys
    const dialogData = clone(this.data)
    for (const key in this.components) {
      if (!(key in dialogData)) {
        dialogData[key] = null
      }
    }
    return {
      windowEvents: null,
      dialogData
    }
  },

  computed: {
    dialogComponent() {
      return this
    },

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
      this.resolve(this.dialogData)
    },

    cancel() {
      if (this.hasCancel) {
        this.resolve(null)
      }
    }
  }
})
</script>
