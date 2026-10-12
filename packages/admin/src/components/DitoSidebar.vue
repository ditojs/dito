<template lang="pug">
aside.dito-sidebar.dito-scroll-parent
  nav.dito-header
    slot
  .dito-sidebar__teleport.dito-scroll
</template>

<style lang="scss">
@import '../styles/_imports';

.dito-sidebar {
  // For the layout of `DitoContainer` in narrow sidebars:
  container: dito-sidebar / inline-size;
  flex: 0 1 $sidebar-max-width;
  max-width: $sidebar-max-width;
  min-width: $sidebar-min-width;
}
</style>
