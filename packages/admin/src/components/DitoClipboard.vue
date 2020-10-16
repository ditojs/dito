<template lang="pug">
  .dito-clipboard.dito-buttons.dito-buttons-round(
    v-if="clipboard"
  )
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
import DitoContext from '@/DitoContext'
import DomMixin from '@/mixins/DomMixin'
import { isObject, clone, deindent } from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('dito-clipboard', {
  mixins: [DomMixin],

  props: {
    clipboard: { type: [Boolean, Object], default: false },
    dataPath: { type: String, required: true },
    data: { type: [Object, Array], default: null }
  },

  data() {
    return {
      copyEnabled: false,
      pasteEnabled: false,
      clipboardData: null
    }
  },

  computed: {
    clipboardConfig() {
      return isObject(this.clipboard) ? this.clipboard : {}
    },

    copyData() {
      const { copy } = this.clipboardConfig
      return copy
        ? data => copy.call(this, data, this.getDitoContext())
        : data => clone(data)
    },

    pasteData() {
      const { paste } = this.clipboardConfig
      return paste
        ? data => paste.call(this, data, this.getDitoContext())
        : data => data
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

    getDitoContext() {
      return new DitoContext(this, {
        name: undefined,
        value: undefined,
        data: this.data,
        dataPath: this.dataPath
      })
    },

    async checkClipboard() {
      this.copyEnabled = !!this.data
      // See if the clipboard content is valid JSON data that is compatible
      // with the current target schema, and only then activate the pasting:
      this.pasteEnabled = !!(await this.getClipboardData(false)) // don't report
    },

    async onCopy() {
      let data = this.schemaComponent?.clipboardData
      data = data && this.copyData(data)
      // Keep an internal clipboard as fallback.
      this.clipboardData = data
      try {
        const json = JSON.stringify(data, null, 2)
        await navigator.clipboard?.writeText?.(json)
        // See if we can activate the paste button now, dependding on browsers:
        await this.checkClipboard()
      } catch (err) {
        console.error(err, err.name, err.message)
      }
    },

    async onPaste() {
      let data = await this.getClipboardData(true) // report
      data = data && this.pasteData(data)
      if (data) {
        this.schemaComponent.setData(data)
      }
    }
  }
})
</script>
