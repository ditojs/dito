<template lang="pug">
ul.dito-menu(
  v-resize="onResize"
  :style="{ '--width': width ? `${width}px` : null }"
)
  li(
    v-for="item in items"
  )
    template(
      v-if="shouldRenderSchema(item)"
    )
      a.dito-link(
        :href="getItemHref(item)"
        :class="getItemClass(item, 'dito-sub-menu-link')"
        @click.prevent.stop="onClickItem(item)"
      ) {{ getLabel(item) }}
      DitoMenu(
        v-if="item.items"
        :class="getItemClass(item, 'dito-sub-menu')"
        :items="item.items"
        :path="getItemPath(item, false)"
      )
</template>

<script>
import DitoComponent from '../DitoComponent.js'

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

  data() {
    return {
      width: 0
    }
  },

  methods: {
    onResize({ contentRect: { width } }) {
      if (width) {
        this.width = width
      }
    },

    getItemClass(item, subMenuClass) {
      return {
        [subMenuClass]: !!item.items,
        'dito-active': this.isActiveItem(item)
      }
    },

    getItemPath(item, firstChild) {
      const path = item.path ? `${this.path}/${item.path}` : null
      return firstChild && path && item.items
        ? `${path}${this.getItemPath(Object.values(item.items)[0], false)}`
        : path
    },

    getItemHref(item) {
      const path = this.getItemPath(item, true)
      return path ? this.$router.resolve(path).href : null
    },

    isActiveItem(item) {
      return (
        this.$route.path.startsWith(this.getItemPath(item, false)) ||
        item.items && Object.values(item.items).some(this.isActiveItem)
      )
    },

    onClickItem(item) {
      const path = this.getItemPath(item, true)
      if (path) {
        this.$router.push({ path, force: true })
      }
    }
  }
})
</script>

<style lang="scss">
@use 'sass:color';
@import '../styles/_imports';

.dito-menu {
  $item-height: $menu-font-size + 2 * $menu-padding-ver;

  border-right: $border-style;
  padding: 0 $menu-spacing;

  li {
    &:has(.dito-sub-menu:not(.dito-active)) {
      // Pop-out sub-menus on hover:
      &:hover {
        .dito-sub-menu-link {
          background: $color-lightest;
        }

        .dito-sub-menu {
          display: block;
          position: absolute;
          width: var(--width);
          z-index: $header-z-index;
          transform: translateX(calc(var(--width) + 2 * $menu-spacing))
            translateY(-$item-height);

          li:first-child {
            .dito-link {
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

        // .dito-sub-menu-link,
        .dito-sub-menu {
          box-shadow: $shadow-window;
        }
      }
    }
  }

  .dito-link {
    display: block;
    padding: $menu-padding;
    line-height: $menu-line-height;
    border-radius: $border-radius;
    margin-top: $menu-spacing;

    &:focus:not(:active, .dito-active) {
      box-shadow: $shadow-focus;
    }

    &:hover {
      background: rgba(255, 255, 255, 0.5);
    }

    &.dito-active {
      color: $color-white;
      background: $color-active;
    }
  }

  .dito-sub-menu-link {
    &.dito-active {
      background: color.adjust($color-active, $alpha: -0.3);
    }
  }

  .dito-sub-menu {
    display: none;
    border-right: 0;
    padding: 0;
    border-radius: $border-radius;
    background: $color-lightest;

    &.dito-active {
      display: block;
    }
  }
}
</style>
