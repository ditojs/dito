<template lang="pug">
aside.dito-sidebar.dito-scroll-parent(
  v-resize="onResizeSidebar"
  :class="classes"
)
  nav.dito-header
    slot
  .dito-sidebar__teleport.dito-scroll
</template>

<script>
import DitoComponent from '../DitoComponent.js'

// @vue/component
export default DitoComponent.component('DitoSidebar', {
  data() {
    return {
      sidebarWidth: 0
    }
  },

  computed: {
    classes() {
      const prefix = 'dito-sidebar'
      // NOTE: Keep synced with $sidebar-max-width in SCSS:
      const sidebarWidth = 360
      return {
        [`${prefix}--width-99`]: this.sidebarWidth < sidebarWidth,
        [`${prefix}--width-60`]: this.sidebarWidth <= sidebarWidth * 0.6
      }
    }
  },

  methods: {
    onResizeSidebar({ contentRect: { width } }) {
      this.sidebarWidth = width
    }
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-sidebar {
  flex: 0 1 $sidebar-max-width;
  max-width: $sidebar-max-width;
  min-width: $sidebar-min-width;
}
</style>
