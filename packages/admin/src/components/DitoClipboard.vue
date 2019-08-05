<template lang="pug">
  .dito-clipboard.dito-buttons.dito-buttons-round
    button.dito-button.dito-button-copy(
      type="button"
      ref="copyData"
      title="Copy Data"
      :disabled="!copyEnabled"
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
import { clone, deindent } from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('dito-clipboard', {
  mixins: [DomMixin],

  props: {
    data: { type: [Object, Array], default: null }
  },

  data() {
    return {
      copyEnabled: false,
      pasteEnabled: false,
      clipboardData: null
    }
  },

  mounted() {
    // Check clipboard content whenever something gets copied or the window gets
    // (re)activated, as those are the moments when the clipboard can change:
    this.domOn(document, {
      copy: this.checkClipboard
    })
    this.domOn(window, {
      focus: this.checkClipboard
    })
    this.$watch('data', this.checkClipboard)
    // If we already have data (e.g. create form), then check right away also:
    if (this.data) {
      this.checkClipboard()
    }
  },

  methods: {
    async getClipboardData(report) {
      let { clipboardData } = this // Use the internal clipboard as fallback.
      try {
        const json = await navigator.clipboard?.readText?.()
        if (json) {
          clipboardData = JSON.parse(json)
        }
      } catch (err) {
        if (report) {
          console.error(err, err.name, err.message)
          if (err.name === 'SyntaxError') {
            alert(deindent`
              The data in the clipboard appears to be malformed:
              ${err.message}
            `)
          }
        }
      }
      const { $schema, ...data } = clipboardData || {}
      return $schema === this.schemaComponent?.schema.name ? data : null
    },

    async checkClipboard() {
      this.copyEnabled = !!this.data
      // See if the clipboard content is valid JSON data that is compatible
      // with the current target schema, and only then activate the pasting:
      this.pasteEnabled = !!(await this.getClipboardData(false)) // don't report
    },

    async onCopy() {
      const data = this.schemaComponent?.clipboardData
      // Keep an internal clipboard as fallback.
      this.clipboardData = clone(data)
      try {
        const json = JSON.stringify(data, null, '  ')
        await navigator.clipboard?.writeText?.(json)
        // See if we can activate the paste button now, dependding on browsers:
        await this.checkClipboard()
      } catch (err) {
        console.error(err, err.name, err.message)
      }
    },

    async onPaste() {
      const data = await this.getClipboardData(true) // report
      if (data) {
        this.schemaComponent.setData(data)
      }
    }
  }
})
</script>
