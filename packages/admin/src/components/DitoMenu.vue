<template lang="pug">
ul.dito-menu
  li.dito-menu__item(
    v-for="node in nodes"
  )
    template(
      v-if="shouldShowNode(node)"
    )
      RouterLink(
        v-slot="{ href, navigate }"
        :to="{ path: getPath(node.linkRouteName), force: true }"
        custom
      )
        a.dito-menu__link(
          :href="href"
          :class="{ 'dito-menu__link--active': isActiveNode(node) }"
          :aria-current="isActiveNode(node) ? 'page' : null"
          @click="navigate"
        ) {{ getLabelText(node.schema) }}
      DitoMenu.dito-menu__sub(
        v-if="node.items"
        :nodes="node.items"
      )
</template>

<script>
import { useRoute, useRouter } from 'vue-router'
import SchemaContext from '../SchemaContext.js'
import { useServices } from '../composables/useSchemaContext.ts'
import { useSchemaValue } from '../composables/useSchemaValue.ts'
import { isPathWithin } from '../utils/route.js'

// `force` reloads the view of a link even if its route is the current one.
export default {
  props: {
    nodes: { type: Array, required: true }
  },

  setup() {
    const route = useRoute()
    const router = useRouter()
    const { getLabelText, shouldRenderSchema } = useSchemaValue(
      new SchemaContext(useServices(), { nested: false })
    )

    // Navigate to the paths of the routes rather than their names, so that the
    // router also matches their default children, like the forms of objects:
    const getPath = routeName => router.resolve({ name: routeName }).path

    return {
      getLabelText,
      getPath,

      shouldShowNode(node) {
        return (
          shouldRenderSchema(node.schema) && (
            !node.items ||
            node.items.some(item => shouldRenderSchema(item.schema))
          )
        )
      },

      isActiveNode(node) {
        return isPathWithin(route.path, getPath(node.routeName))
      }
    }
  }
}
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
