<template lang="pug">
aside.dito-sidebar.dito-scroll-parent
  nav.dito-header
    slot
</template>

<script>
import DitoComponent from '../DitoComponent.js'

// @vue/component
export default DitoComponent.component('DitoSidebar', {})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-sidebar {
  flex: 0 4 $sidebar-max-width;
  max-width: $sidebar-max-width;
  min-width: $sidebar-min-width;
}
</style>
