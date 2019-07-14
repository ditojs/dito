<template lang="pug">
  .dito-clipboard.dito-buttons.dito-buttons-round
    button.dito-button.dito-button-copy(
      type="button"
      ref="copyData"
      title="Copy Data"
      @click="onCopy"
    )
    button.dito-button.dito-button-paste(
      type="button"
      title="Paste Data"
      :disabled="!pasteEnabled"
      @click="onPaste"
    )
</template>

<script>
import DitoComponent from '@/DitoComponent'
import DomMixin from '@/mixins/DomMixin'
import { deindent } from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('dito-clipboard', {
  mixins: [DomMixin],

  data() {
    return {
      pasteEnabled: false
    }
  },

  mounted() {
    // Check clipboard content whenever something gets copied or the window gets
    // (re)activated, as those are the moments when the clipboard can change:
    this.domOn(document, {
      copy: this.onClipboardChange
    })
    this.domOn(window, {
      focus: this.onClipboardChange
    })
  },

  methods: {
    async handlePaste(callback) {
      const json = await navigator.clipboard.readText()
      const data = JSON.parse(json)
      const target = this.schemaComponent?.data
      if (data && target) {
        for (const key in data) {
          if (callback(target, key, data[key]) === false) {
            return false
          }
        }
        return true
      }
    },

    async onClipboardChange() {
      try {
        // See if the clipboard content is valid JSON data that is compatible
        // with the current target schema, and only then activate the pasting:
        this.pasteEnabled = await this.handlePaste(
          (target, key) => key in target
        )
      } catch (err) {
        this.pasteEnabled = false
      }
    },

    async onCopy() {
      const data = this.schemaComponent?.clipboardData
      try {
        const json = JSON.stringify(data, null, '  ')
        await navigator.clipboard.writeText(json)
        // See if we can activate the paste button now, dependding on browsers:
        await this.onClipboardChange()
      } catch (err) {
        this.handleError(err)
      }
    },

    async onPaste() {
      try {
        this.pasteEnabled = await this.handlePaste(
          (target, key, value) => {
            if (key in target) {
              this.$set(target, key, value)
            }
          }
        )
      } catch (err) {
        this.handleError(err)
      }
    },

    handleError(err) {
      console.log(err, err.name, err.message)
      switch (err.name) {
      case 'NotAllowedError':
        alert(deindent`
          Clipboard access is currently blocked:
          ${err.message}
          Please check your browser's permissions.
        `)
        break
      case 'SyntaxError':
        alert(deindent`
          Clipboard data appears to be malformed:
          ${err.message}
        `)
        break
      }
    }
  }
})
</script>
