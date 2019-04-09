<template lang="pug">
  .dito-panels
    dito-panel(
      v-for="{ schema, dataPath } in panels"
      v-if="shouldRender(schema)"
      ref="panels"
      :key="dataPath"
      :schema="schema"
      :dataPath="dataPath"
      :data="data"
      :meta="meta"
      :store="getChildStore(schema.name)"
      :disabled="schema.disabled != null ? schema.disabled : disabled"
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
</style>

<script>
import DitoComponent from '@/DitoComponent'
import { getAbsoluteBoundingRect } from '@ditojs/ui'

// @vue/component
export default DitoComponent.component('dito-panels', {
  props: {
    panels: { type: Object, default: null },
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
    if (this.panels) {
      this.schemaComponent.on('layout', () => this.updateLayout())
    }
  },

  methods: {
    updateLayout() {
      // Whenever the layout changes (e.g. on data load or change), recalculate
      // the vertical offsets of all panels, taking into account their anchor
      // components, as well as their own height.
      const scroll = this.$el.closest('.dito-scroll')
      const scrollTop = scroll.getBoundingClientRect().top
      let bottom = 0
      for (const panel of this.$refs.panels) {
        const target = document.getElementById(panel.target)
        let component = target && target.closest('.dito-component')
        // For TypePanel components (.dito-panel-anchor), skip to the previous
        // component that is not a TypePanel for positioning of the panel:
        if (component && component.classList.contains('dito-panel-anchor')) {
          let container = component.parentNode.previousSibling
          while (
            container && (
              // When using `if`, we can end up with text nodes containing
              // empty HTML comments here, handle these separately:
              container.nodeType !== 1 ||
              container.querySelector('.dito-panel-anchor')
            )
          ) {
            container = container.previousSibling
          }
          if (container) {
            component = container.querySelector('.dito-component')
          }
        }
        if (component) {
          // Allow components to define an internal element as the anchor for
          // panels, e.g. TypeList, to take .dito-navigation into account.
          const anchor = component.querySelector('.dito-anchor') || component
          // Make sure panels don't cover each other, by taking the bottom of
          // the previous panel into account.
          const margin = parseFloat(
            window.getComputedStyle(anchor, '').marginTop
          )
          const top = Math.max(
            bottom,
            getAbsoluteBoundingRect(anchor).top - scrollTop - margin
          )
          this.$set(this.offsets, panel.dataPath, top)
          bottom = top + panel.$el.getBoundingClientRect().height
        }
      }
    }
  }
})
</script>
