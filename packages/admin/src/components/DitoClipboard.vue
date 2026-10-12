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

export default {
  name: 'DitoClipboard',
  components: { DitoButton },
  emits: ['paste'],

  props: {
    clipboard: { type: [Boolean, Object], required: true },
    schema: { type: Object, required: true },
    hasData: { type: Boolean, required: true },
    // Returns the data to copy. A function rather than the data itself, so
    // that it's only processed when copying.
    getData: { type: Function, required: true },
    // Creates the context of the schema for the `copy()` and `paste()`
    // callbacks of `clipboard`:
    createContext: { type: Function, required: true }
  },

  setup(props, { emit }) {
    const admin = inject('admin')
    const { domOn } = useDomEvents()

    const updateClipboardData = () => {
      // Only Chrome reads the clipboard without asking for permission, so
      // other browsers only read it when pasting.
      if (appState.agent.chrome) {
        // Errors are only reported when pasting.
        readClipboardData().catch(() => {})
      }
    }

    // Notifications log their error too:
    const notifyClipboardError = (error, text = error.message) => {
      admin.notify({ type: 'error', error, title: 'Clipboard Error', text })
    }

    const clipboardOptions = computed(() =>
      isObject(props.clipboard) ? props.clipboard : {}
    )

    onMounted(() => {
      // Read the clipboard right away, and whenever something gets copied or
      // the window gets (re)activated, as those are the moments when it can
      // change:
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
