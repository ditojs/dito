<template lang="pug">
.dito-dialog(
  ref="dialog"
  role="dialog"
  aria-expanded="true"
  aria-modal="true"
  :style="{ '--width': `${settings.width}px` }"
  @mouseup="onMouseUp"
)
  UseFocusTrap.dito-dialog__focus-trap(
    :options="{ immediate: true, fallbackFocus: () => $refs.dialog }"
  )
    form.dito-scroll-parent(
      @submit.prevent="submit"
    )
      DitoSchema(
        :schema="schema"
        :data="dialogData"
        scrollable
        generateLabels
      )
        template(#buttons)
          DitoButtons.dito-buttons-large(
            :buttons="buttonSchemas"
            :data="dialogData"
          )
</template>

<script>
import { clone } from '@ditojs/utils'
import { addEvents } from '@ditojs/ui/src'
import DitoComponent from '../DitoComponent.js'
import { getButtonSchemas } from '../utils/schema.js'
import { UseFocusTrap } from '@vueuse/integrations/useFocusTrap/component'

// @vue/component
export default DitoComponent.component('DitoDialog', {
  components: { UseFocusTrap },
  emits: ['remove'],

  provide() {
    return {
      $dialogComponent: () => this
    }
  },

  props: {
    components: { type: Object, required: true },
    buttons: { type: Object, required: true },
    promise: { type: Object, required: true },
    data: { type: Object, default: () => ({}) },
    settings: {
      type: Object,
      default: () => ({
        width: 480,
        clickToClose: false
      })
    }
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

    schema() {
      return {
        type: 'dialog',
        components: this.components
      }
    },

    buttonSchemas() {
      return Object.fromEntries(
        Object.entries(getButtonSchemas(this.buttons)).map(
          // Process the button schemas to add default click events
          // for both 'submit' and 'cancel' buttons:
          ([key, schema]) => {
            if (key === 'cancel' && !schema.events) {
              schema = {
                ...schema,
                events: {
                  click: () => this.cancel()
                }
              }
            }
            return [key, schema]
          }
        )
      )
    },

    hasButtons() {
      return Object.keys(this.buttonSchemas).length > 0
    },

    hasCancel() {
      return !!this.buttonSchemas.cancel
    }
  },

  mounted() {
    this.windowEvents = addEvents(window, {
      keyup: event => {
        if ((this.hasCancel || !this.hasButtons) && event.keyCode === 27) {
          this.cancel()
        }
      }
    })
  },

  unmounted() {
    this.windowEvents.remove()
  },

  methods: {
    remove() {
      this.$emit('remove')
    },

    resolve(value) {
      this.promise.resolve(value)
      this.remove()
    },

    reject(value) {
      this.promise.reject(value)
      this.remove()
    },

    submit() {
      this.resolve(this.dialogData)
    },

    cancel() {
      // When cancelling, resolve as `undefined` so we can have dialogs
      // returning null as a defined value as well.
      this.resolve(undefined)
    },

    close() {
      this.cancel()
    },

    onMouseUp() {
      if (this.settings.clickToClose) {
        this.close()
      }
    }
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-dialog {
  position: fixed;
  display: flex;
  inset: 0;
  z-index: 2000;
  padding: $content-padding;
  align-items: center;
  justify-content: center;
  // Prevent scrolling of the page behind the dialog:
  overflow: hidden;
  background: rgba(0, 0, 0, 0.2);

  &__focus-trap {
    display: flex;
    max-height: 100%;
  }

  // TODO: `&__inner`
  form {
    position: relative;
    display: flex;
    box-sizing: border-box;
    background: white;
    border-radius: $border-radius;
    max-width: var(--width, 480px);
    max-height: 100%;
    box-shadow: 0 20px 60px -2px rgba(27, 33, 58, 0.4);
  }
}

.dito-dialog-enter-active,
.dito-dialog-leave-active {
  transition: opacity 0.15s;

  form {
    transition: transform 0.25s;
  }
}

.dito-dialog-enter-from,
.dito-dialog-leave-to {
  opacity: 0;

  form {
    transform: translateY(-20px);
  }
}
</style>
