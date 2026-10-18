<template lang="pug">
nav.dito-navigation.dito-scroll-parent(aria-label="Main navigation")
  .dito-navigation__content.dito-scroll-parent(
    ref="content"
    tabindex="-1"
  )
    h1
      RouterLink.dito-link(to="/") {{ adminContext.title }}
      slot
    DitoMenu.dito-scroll(:nodes="adminContext.routeTree?.nodes ?? []")
</template>

<script>
import { inject, useTemplateRef } from 'vue'
import { adminContextKey } from '../utils/keys.ts'

export default {
  // The content slides in and out, see `useSidebar()` in `DitoRoot`:
  expose: ['content'],

  setup() {
    return {
      adminContext: inject(adminContextKey),
      content: useTemplateRef('content')
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-navigation {
  $self: &;

  @include user-select(none);

  flex: 0 0 auto;
  font-size: $menu-font-size;
  white-space: nowrap;
  // `useSidebar()` animates the space of the docked menu:
  transition: flex-basis $sidebar-duration;

  &__content {
    background: $color-lighter;
    transition: transform $sidebar-duration;

    &:focus {
      outline: none;
    }
  }

  &--collapsed {
    flex-basis: 0;

    // Double the class to free the space also when apps give the menu a
    // minimum width:
    &#{$self} {
      min-width: 0;
    }

    // Hide the content and not the space, whose transitions `useSidebar()`
    // suspends while it sets its start width:
    #{$self}__content {
      transform: translateX(-100%);
      visibility: hidden;
      transition:
        transform $sidebar-duration,
        visibility 0s $sidebar-duration;
    }
  }

  &--closed,
  &--open {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    max-width: 100%;
    z-index: $z-index-sidebar;
    box-shadow: $shadow-window;
    transition: transform $sidebar-duration;
  }

  &--closed {
    transform: translateX(-100%);
    // Hide once the slide is done, but show right away when opening:
    visibility: hidden;
    transition:
      transform $sidebar-duration,
      visibility 0s $sidebar-duration;
  }

  h1 {
    display: flex;
    line-height: $header-line-height;
    font-weight: bold;
    background: $color-darker;
    border-right: $border-width solid $color-darkest;
    color: $color-white;

    .dito-link {
      flex: 1 1 auto;
      padding: $header-padding;
    }
  }

  // The button that closes the overlay menu, which covers the header's toggle:
  &__close {
    position: relative;
    flex: 0 0 auto;
    width: $header-height;
    padding: 0;
    border: 0;
    color: $color-white;
    background: none;

    &::before {
      @extend %icon-clear;
    }

    &:hover {
      color: $color-light;
    }

    &:focus-visible {
      @include focus-ring;
    }
  }
}
</style>
