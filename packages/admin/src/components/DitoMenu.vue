<template lang="pug">
ul.dito-menu
  li.dito-menu__item(
    v-for="item in items"
  )
    template(
      v-if="shouldShowItem(item)"
    )
      RouterLink(
        v-slot="{ href, navigate }"
        :to="getItemRoute(item)"
        custom
      )
        a.dito-menu__link(
          :href="href"
          :class="{ 'dito-menu__link--active': isActiveItem(item) }"
          :aria-current="isActiveItem(item) ? 'page' : null"
          @click="navigate"
        ) {{ getLabel(item) }}
      DitoMenu.dito-menu__sub(
        v-if="item.items"
        :items="item.items"
        :path="getItemPath(item)"
      )
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import { isPathWithin } from '../utils/route.js'
import { getViewLinkPath } from '../utils/schema/lookup.js'

// @vue/component
export default DitoComponent.component('DitoMenu', {
  props: {
    items: {
      type: [Object, Array],
      default: () => []
    },
    path: {
      type: String,
      default: ''
    }
  },

  methods: {
    shouldShowItem(item) {
      return (
        this.shouldRenderSchema(item) && (
          !item.items ||
          Object.values(item.items).some(this.shouldRenderSchema)
        )
      )
    },

    getItemPath(item) {
      return `${this.path}/${item.path}`
    },

    getItemRoute(item) {
      // `DitoRoot` only provides the views once their paths are set up.
      // `force` reloads the view even if it is already the current route.
      return {
        path: getViewLinkPath(item, this.getItemPath(item)),
        force: true
      }
    },

    isActiveItem(item) {
      const path = this.getItemPath(item)
      return (
        isPathWithin(this.$route.path, path) ||
        item.items && Object.values(item.items).some(this.isActiveItem)
      )
    }
  }
})
</script>

<style lang="scss">
@use 'sass:color';
@import '../styles/_imports';

.dito-menu {
  $self: &;
  $item-height: $menu-font-size + 2 * $menu-padding-ver;

  --menu-active-color: #{$color-white};
  --menu-active-background: #{$color-active};

  border-right: $border-style;
  padding: 0 $menu-spacing;

  &__item {
    // Scope the anchor of the open sub-menu to its item, see below.
    anchor-scope: --dito-menu-item;

    &:has(#{$self}__sub):not(:has(#{$self}__link--active)) {
      // Pop-out sub-menus on hover and keyboard focus. They are anchored to
      // their item instead of positioned relative to it, as the menu scrolls
      // and would clip them.
      &:hover,
      &:focus-within {
        anchor-name: --dito-menu-item;

        > #{$self}__link {
          background: $color-lightest;
        }

        > #{$self}__sub {
          display: block;
          position: absolute;
          position-anchor: --dito-menu-item;
          top: anchor(top);
          left: calc(anchor(right) + 2 * $menu-spacing);
          width: anchor-size(width);
          z-index: $z-index-header;
          box-shadow: $shadow-window;

          > #{$self}__item:first-child {
            > #{$self}__link {
              margin-top: 0;
            }
          }

          &::before {
            // Fill the gap to not loose the hover when moving over it.
            content: '';
            position: absolute;
            top: 0;
            left: -2 * $menu-spacing;
            width: 2 * $menu-spacing;
            height: $item-height;
            opacity: 0;
          }
        }
      }
    }
  }

  &__link {
    display: block;
    padding: $menu-padding;
    line-height: $menu-line-height;
    border-radius: $border-radius;
    margin-top: $menu-spacing;

    &:focus-visible {
      @include focus-ring;
    }

    &:hover {
      background: rgb(255, 255, 255, 0.5);
    }

    &--active {
      &,
      &:hover {
        color: var(--menu-active-color);
        background: var(--menu-active-background);
      }

      &:has(+ #{$self}__sub) {
        --menu-active-background: #{color.adjust($color-active, $alpha: -0.3)};
      }
    }
  }

  &__sub {
    display: none;
    border-right: 0;
    padding: 0;
    border-radius: $border-radius;
    background: $color-lightest;
  }

  &__link--active + &__sub {
    display: block;
  }
}
</style>
