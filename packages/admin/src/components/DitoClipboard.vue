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
import { isObject, clone } from '@ditojs/utils'
import { DitoButton } from '@ditojs/ui/src'
import DitoComponent from '../DitoComponent.js'
import DomMixin from '../mixins/DomMixin.js'
import DitoContext from '../DitoContext.js'
import {
  getClipboardData,
  hasClipboardData,
  copyClipboardData,
  readClipboardData
} from '../utils/clipboard.js'

// @vue/component
export default DitoComponent.component('DitoClipboard', {
  mixins: [DomMixin],
  components: { DitoButton },

  emits: ['paste'],

  props: {
    clipboard: { type: [Boolean, Object], required: true },
    schema: { type: Object, required: true },
    hasData: { type: Boolean, required: true },
    // Returns the data to copy. A function rather than the data itself, so
    // that it's only processed when copying.
    getData: { type: Function, required: true }
  },

  computed: {
    clipboardOptions() {
      return isObject(this.clipboard) ? this.clipboard : {}
    },

    copyData() {
      const { copy } = this.clipboardOptions
      return copy
        ? clipboardData =>
            copy.call(this, new DitoContext(this, { clipboardData }))
        : clipboardData => clone(clipboardData)
    },

    pasteData() {
      const { paste } = this.clipboardOptions
      return paste
        ? clipboardData =>
            paste.call(this, new DitoContext(this, { clipboardData }))
        : clipboardData => clipboardData
    },

    isPasteEnabled() {
      return hasClipboardData(this.schema.name)
    }
  },

  mounted() {
    // Read the clipboard right away, and whenever something gets copied or the
    // window gets (re)activated, as those are the moments when it can change:
    this.updateClipboardData()
    this.domOn(document, { copy: this.updateClipboardData })
    this.domOn(window, { focus: this.updateClipboardData })
  },

  methods: {
    updateClipboardData() {
      // Only Chrome reads the clipboard without asking for permission, so
      // other browsers only read it when pasting.
      if (this.appState.agent.chrome) {
        // Errors are only reported when pasting.
        readClipboardData().catch(() => {})
      }
    },

    async onCopy() {
      try {
        const data = this.getData()
        await copyClipboardData(this.schema.name, data && this.copyData(data))
      } catch (error) {
        this.notifyClipboardError(error)
      }
    },

    async onPaste() {
      try {
        await readClipboardData()
      } catch (error) {
        if (error.name === 'SyntaxError') {
          this.notifyClipboardError(error, [
            'The data in the clipboard appears to be malformed:',
            error.message
          ])
          return
        }
        // Fall back to the data copied inside the admin.
        console.error(error, error.name, error.message)
      }
      try {
        const data = getClipboardData(this.schema.name)
        const pastedData = data && this.pasteData(data)
        if (pastedData) {
          this.$emit('paste', pastedData)
        }
      } catch (error) {
        this.notifyClipboardError(error)
      }
    },

    notifyClipboardError(error, text = error.message) {
      // Notifications log their error too.
      this.notify({ type: 'error', error, title: 'Clipboard Error', text })
    }
  }
})
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
