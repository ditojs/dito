<template lang="pug">
nav.dito-sidebar.dito-scroll-parent
  h1
    RouterLink.dito-link(to="/") {{ appState.title }}
  DitoMenu.dito-scroll(:items="views")
</template>

<script>
import DitoComponent from '../DitoComponent.js'

// @vue/component
export default DitoComponent.component('DitoSidebar', {})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-sidebar {
  @include user-select(none);

  flex: initial;
  font-size: $menu-font-size;
  white-space: nowrap;
  background: $color-lighter;

  h1 {
    display: block;
    line-height: $header-line-height;
    font-weight: bold;
    background: $color-darker;
    border-right: $border-width solid $color-darkest;
    color: $color-white;

    .dito-link {
      display: block;
      padding: $header-padding;
    }
  }
}
</style>
