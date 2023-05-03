<template lang="pug">
nav.dito-navigation.dito-scroll-parent
  h1
    RouterLink.dito-link(to="/") {{ appState.title }}
  DitoMenu.dito-scroll(:items="views")
</template>

<script>
import DitoComponent from '../DitoComponent.js'

// @vue/component
export default DitoComponent.component('DitoNavigation', {})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-navigation {
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
