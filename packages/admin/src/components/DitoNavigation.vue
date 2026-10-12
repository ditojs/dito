<template lang="pug">
nav.dito-navigation.dito-scroll-parent(aria-label="Main navigation")
  h1
    RouterLink.dito-link(to="/") {{ appState.title }}
  DitoMenu.dito-scroll(:nodes="adminContext.routeTree?.nodes ?? []")
</template>

<script>
import { inject } from 'vue'
import appState from '../appState.js'

export default {
  name: 'DitoNavigation',

  setup() {
    return { adminContext: inject('adminContext'), appState }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-navigation {
  @include user-select(none);

  flex: 0 0 min-content;
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
