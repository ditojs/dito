<template lang="pug">
.dito-clipboard.dito-buttons.dito-buttons-round(
  v-if="clipboard"
)
  button.dito-button.dito-button-copy(
    ref="copyData"
    type="button"
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
import { isObject, clone, deindent } from '@ditojs/utils'
import DitoComponent from '../DitoComponent.js'
import DomMixin from '../mixins/DomMixin.js'
import DitoContext from '../DitoContext.js'

// @vue/component
export default DitoComponent.component('DitoClipboard', {
  mixins: [DomMixin],

  props: {
    clipboard: { type: [Boolean, Object], required: true },
    schema: { type: Object, required: true },
    dataPath: { type: String, required: true },
    data: { type: [Object, Array], default: null }
  },

  data() {
    return {
      copyEnabled: false,
      pasteEnabled: false
    }
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
    }
  },

  watch: {
    'parentComponent.hasData': {
      // Check right away also in case there's already data (e.g. create form).
      immediate: true,
      handler(hasData) {
        this.copyEnabled = hasData
      }
    },
    'appState.clipboardData': 'updatePaste'
  },

  mounted() {
    // Check clipboard content whenever something gets copied or the window gets
    // (re)activated, as those are the moments when the clipboard can change:
    this.domOn(document, { copy: this.updatePaste })
    this.domOn(window, { focus: this.updatePaste })
  },

  methods: {
    checkClipboardData(clipboardData) {
      const { $schema, ...data } = clipboardData || {}
      return $schema === this.schema.name ? data : null
    },

    async getClipboardData(report) {
      // Use the internal clipboard as fallback.
      let { clipboardData } = this.appState
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
      return this.checkClipboardData(clipboardData)
    },

    async updatePaste() {
      this.pasteEnabled = !!this.checkClipboardData(this.appState.clipboardData)
      if (!this.pasteEnabled && this.appState.agent.chrome) {
        // See if the clipboard content is valid JSON data that is compatible
        // with the current target schema, and only then activate the pasting:
        const data = await this.getClipboardData(false) // Don't report
        this.pasteEnabled = !!data
      }
    },

    async onCopy() {
      let data = this.parentComponent.clipboardData
      try {
        if (data) {
          data = {
            $schema: this.schema.name,
            ...this.copyData(data)
          }
        }
        // Keep an internal clipboard as fallback.
        this.appState.clipboardData = data
        this.pasteEnabled = true
        try {
          const json = JSON.stringify(data, null, 2)
          await navigator.clipboard?.writeText?.(json)
        } catch (err) {
          console.error(err, err.name, err.message)
        }
      } catch (error) {
        console.error(error)
        alert(error.message)
      }
    },

    async onPaste() {
      let data = await this.getClipboardData(true) // Report
      data = data && this.pasteData(data)
      if (data) {
        this.parentComponent.clipboardData = data
      }
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
