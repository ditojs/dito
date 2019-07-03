<template lang="pug">
  .dito-clipboard
    .dito-buttons.dito-buttons-round
      button.dito-button.dito-button-copy(
        type="button"
        ref="copyData"
        title="Copy Data"
      )
      button.dito-button.dito-button-paste(
        type="button"
        @click="pasteData"
        title="Paste Data"
        :disabled="!appState.clipboardData"
      )
</template>

<script>
import DitoComponent from '@/DitoComponent'
import Clipboard from 'clipboard'
import { clone } from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('dito-clipboard', {
  data() {
    return {
      clipboard: null
    }
  },

  mounted() {
    this.clipboard = new Clipboard(this.$refs.copyData, {
      text: () => {
        const data = this.schemaComponent?.clipboardData
        this.appState.clipboardData = clone(data)
        return JSON.stringify(data)
      },
      action: 'copy'
    })
  },

  destroyed() {
    this.clipboard?.destroy()
  },

  methods: {
    pasteData() {
      const { clipboardData } = this.appState
      const targetData = this.schemaComponent?.data
      if (clipboardData && targetData) {
        for (const key in clipboardData) {
          if (key in targetData) {
            this.$set(targetData, key, clipboardData[key])
          }
        }
      }
    }
  }
})
</script>
