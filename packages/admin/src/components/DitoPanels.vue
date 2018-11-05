<template lang="pug">
  .dito-panels
    dito-panel(
      v-for="(schema, dataPath) in panels"
      ref="panels"
      :key="dataPath"
      :schema="schema"
      :dataPath="dataPath"
      :data="data"
      :meta="meta"
      :store="getChildStore(schema.name)"
      :disabled="disabled"
      :top="offsets[dataPath]"
    )
</template>

<style lang="sass">
.dito
  .dito-panels
    position: relative
    margin: (-$content-padding) 0 0 ($content-padding)
    max-width: $content-sidebar-width
    min-width: $content-sidebar-width * 3 / 4
    .dito-panel
      position: absolute
      left: 0
      right: 0
</style>

<script>
import DitoComponent from '@/DitoComponent'
import { getAbsoluteBoundingRect } from '@ditojs/ui'

// @vue/component
export default DitoComponent.component('dito-panels', {
  props: {
    panels: { type: Object, required: true },
    data: { type: Object, required: true },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    disabled: { type: Boolean, required: true }
  },

  data() {
    return {
      offsets: {}
    }
  },

  mounted() {
    // Whenever the layout changes (e.g. on data load or change), recalculate
    // the vertical offets of all panels, taking into account their anchor
    // components, as well as their own height.
    this.schemaComponent.on(['load', 'change'], () => {
      const scrollTop = this.$el
        .closest('.dito-scroll')
        .getBoundingClientRect().top
      const { panels } = this.$refs
      let index = 0
      let bottom = 0
      for (const dataPath of Object.keys(this.panels)) {
        const el = document.getElementById(dataPath)
        let comp = el && el.closest('.dito-component')
        // For TypePanel components (.dito-panel-anchor), skip to the previuous
        // component that is not a TypePanel for positioning of the panel:
        if (comp && comp.classList.contains('dito-panel-anchor')) {
          let container = comp.parentNode.previousSibling
          while (
            container &&
            container.querySelector('.dito-panel-anchor')
          ) {
            container = container.previousSibling
          }
          if (container) {
            comp = container.querySelector('.dito-component')
          }
        }
        const panel = panels[index++]
        if (comp) {
          // Make sure panels don't cover each other, by taking the bottom of
          // the previous panel into account.
          const top = Math.max(
            bottom,
            getAbsoluteBoundingRect(comp).top - scrollTop
          )
          this.$set(this.offsets, dataPath, top)
          bottom = top + panel.$el.getBoundingClientRect().height
        }
      }
    })
  }
})
</script>
