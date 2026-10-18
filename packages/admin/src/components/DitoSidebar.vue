<template lang="pug">
aside.dito-sidebar
  nav.dito-header
    slot
  #dito-sidebar.dito-sidebar__teleport.dito-scroll(
    ref="region"
    tabindex="-1"
  )
</template>

<script>
import { useTemplateRef } from 'vue'

export default {
  // The panels slide in and out, see `useSidebar()` in `DitoRoot`:
  expose: ['region'],

  setup() {
    return {
      region: useTemplateRef('region')
    }
  }
}
</script>

<style lang="scss">
@use 'sass:list';
@import '../styles/_imports';

.dito-sidebar {
  $self: &;

  // Not a `dito-scroll-parent`, so the panels can slide out to the edge of the
  // window without being clipped:
  display: flex;
  flex-direction: column;
  flex: 0 1 $sidebar-max-width;
  max-width: $sidebar-max-width;
  min-width: $sidebar-min-width;
  // `useSidebar()` animates the space of the docked sidebar:
  transition: flex-basis $sidebar-duration;

  > .dito-header {
    // Above the header of the notifications, which continues it to the window
    // edge:
    z-index: $z-index-header + 1;
    // Leave room for the button, for when the sidebar reaches the window edge:
    padding-right: $header-height;
  }

  .dito-header__toggle {
    // At the window edge, where it stays while the sidebar slides:
    position: fixed;
    top: 0;
    right: 0;
    height: $header-height;

    &::before {
      transform: scaleX(-1); // Mirror the icon for the sidebar on the right.
    }
  }

  &:has(#{$self}__teleport:empty) {
    > .dito-header {
      padding-right: 0;
    }

    .dito-header__toggle {
      display: none;
    }
  }

  &__teleport {
    // For the layout of `DitoContainer` in narrow sidebars:
    container: dito-sidebar / inline-size;
    transition: transform $sidebar-duration;

    &:focus {
      outline: none;
    }
  }

  &--collapsed,
  &--closed,
  &--open {
    flex: 0 0 max-content;
    min-width: 0;
  }

  &--collapsed #{$self}__teleport {
    // Slide out to the edge of the window, wherever the sidebar is:
    transform: translateX(var(--sidebar-edge, 100vw));
  }

  &--collapsed,
  &--closed {
    #{$self}__teleport {
      // Hide once the slide is done, but show right away when expanding:
      visibility: hidden;
      transition:
        transform $sidebar-duration,
        visibility 0s $sidebar-duration;
    }
  }

  &--closed,
  &--open {
    #{$self}__teleport {
      position: fixed;
      top: $header-height;
      right: 0;
      bottom: 0;
      width: $sidebar-max-width;
      max-width: 100%;
      z-index: $z-index-sidebar;
      background: $content-color-background;
      box-shadow: $shadow-window;
    }
  }

  &--closed #{$self}__teleport {
    // Also slide the shadow out of the window, by the size of its blur:
    transform: translateX(calc(100% + #{list.nth($shadow-window, 3)}));
  }
}
</style>
