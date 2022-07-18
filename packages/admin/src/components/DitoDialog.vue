<template lang="pug">
  form.dito-dialog(@submit.prevent="submit")
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
            if (type === 'cancel') {
              schema = {
                ...schema,
                events: {
                  click() {
                    this.cancel()
                  }
                }
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
      return !!this.buttonSchemas.cancel
    }
  },

  mounted() {
    this.windowEvents = addEvents(window, {
      keyup: () => {
        if (this.hasCancel && event.keyCode === 27) {
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

    submit() {
      this.resolve(this.dialogData)
    },

    cancel() {
      this.resolve(null)
    }
  }
})
</script>
