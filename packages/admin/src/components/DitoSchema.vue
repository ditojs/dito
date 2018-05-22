<template lang="pug">
  .dito-schema.dito-scroll-parent
    dito-form-header(
      :tabs="tabs"
      :selectedTab="selectedTab"
      :clipboard="clipboard"
    )
    .dito-scroll
      .dito-scroll-content
        dito-components(
          v-for="(tabSchema, key) in tabs"
          v-show="selectedTab === key"
          :key="key"
          :tab="key"
          :schema="tabSchema"
          :dataPath="dataPath"
          :data="data"
          :meta="meta"
          :store="store"
          :disabled="disabled"
          :generateLabels="generateLabels"
        )
        dito-components(
          :schema="schema"
          :dataPath="dataPath"
          :data="data"
          :meta="meta"
          :store="store"
          :disabled="disabled"
          :generateLabels="generateLabels"
        )
        slot(name="buttons")
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-schema', {
  props: {
    schema: { type: Object },
    dataPath: { type: String, default: '' },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    disabled: { type: Boolean, required: true },
    generateLabels: { type: Boolean, default: true }
  },

  computed: {
    tabs() {
      return this.schema?.tabs
    },

    selectedTab() {
      const { hash } = this.$route
      return hash?.substring(1) || this.tabs && Object.keys(this.tabs)[0] || ''
    },

    clipboard() {
      return this.schema?.clipboard
    }
  }
})
</script>
