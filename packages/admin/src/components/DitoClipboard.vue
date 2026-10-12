<template lang="pug">
.dito-clipboard.dito-buttons.dito-buttons--round(
  v-if="clipboard"
)
  DitoButton.dito-button--copy(
    title="Copy Data"
    :disabled="!hasData"
    @click="onCopy"
  )
  DitoButton.dito-button--paste(
    title="Paste Data"
    :disabled="!isPasteEnabled"
    @click="onPaste"
  )
</template>

<script>
import { computed, inject, onMounted } from 'vue'
import { isObject, clone } from '@ditojs/utils'
import { DitoButton } from '@ditojs/ui/src'
import appState from '../appState.js'
import { useDomEvents } from '../composables/useDomEvents.ts'
import {
  getClipboardData,
  hasClipboardData,
  copyClipboardData,
  readClipboardData
} from '../utils/clipboard.js'
import { adminContextKey } from '../utils/keys.ts'

export default {
  name: 'DitoClipboard',
  components: { DitoButton },
  emits: ['paste'],

  props: {
    clipboard: { type: [Boolean, Object], required: true },
    schema: { type: Object, required: true },
    hasData: { type: Boolean, required: true },
    // A function, to only serialize the data when copying:
    getData: { type: Function, required: true },
    // For the `copy()` and `paste()` callbacks of `clipboard`:
    createContext: { type: Function, required: true }
  },

  setup(props, { emit }) {
    const adminContext = inject(adminContextKey)
    const { domOn } = useDomEvents()

    const updateClipboardData = () => {
      // Only Chrome reads the clipboard without asking for permission:
      if (appState.agent.chrome) {
        readClipboardData().catch(() => {}) // Report errors only when pasting.
      }
    }

    // Notifications log their error too:
    const notifyClipboardError = (error, text = error.message) => {
      adminContext.notify({
        type: 'error',
        error,
        title: 'Clipboard Error',
        text
      })
    }

    const clipboardOptions = computed(() =>
      isObject(props.clipboard) ? props.clipboard : {}
    )

    onMounted(() => {
      // Read it now, and again when it can change, on copy and window focus:
      updateClipboardData()
      domOn(document, { copy: updateClipboardData })
      domOn(window, { focus: updateClipboardData })
    })

    return {
      isPasteEnabled: computed(() => hasClipboardData(props.schema.name)),

      async onCopy() {
        const { copy } = clipboardOptions.value
        try {
          const data = props.getData()
          await copyClipboardData(
            props.schema.name,
            data && (
              copy
                ? copy(props.createContext({ clipboardData: data }))
                : clone(data)
            )
          )
        } catch (error) {
          notifyClipboardError(error)
        }
      },

      async onPaste() {
        try {
          await readClipboardData()
        } catch (error) {
          if (error.name === 'SyntaxError') {
            notifyClipboardError(error, [
              'The data in the clipboard appears to be malformed:',
              error.message
            ])
            return
          }
          // Fall back to the data copied inside the admin.
          console.error(error, error.name, error.message)
        }
        const { paste } = clipboardOptions.value
        try {
          const data = getClipboardData(props.schema.name)
          const pastedData = (
            data &&
            (paste ? paste(props.createContext({ clipboardData: data })) : data)
          )
          if (pastedData) {
            emit('paste', pastedData)
          }
        } catch (error) {
          notifyClipboardError(error)
        }
      }
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-clipboard {
  display: flex;

  .dito-schema & {
    // Push clipboard to the right in the flex layout, see:
    // https://codepen.io/tholex/pen/hveBx/
    margin-left: auto;
  }

  .dito-header & {
    margin-left: 0;

    .dito-button {
      margin: 0 0 $tab-margin $tab-margin;
    }
  }
}
</style>
