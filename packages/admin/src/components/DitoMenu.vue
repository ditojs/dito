<template lang="pug">
ul.dito-menu(
  v-resize="onResize"
  :style="{ '--width': width ? `${width}px` : null }"
)
  li.dito-menu__item(
    v-for="item in items"
  )
    template(
      v-if="shouldShowItem(item)"
    )
      a.dito-menu__link(
        :href="getItemHref(item)"
        :class="{ 'dito-menu__link--active': isActiveItem(item) }"
        @click.prevent.stop="onClickItem(item)"
      ) {{ getLabel(item) }}
      DitoMenu.dito-menu__sub(
        v-if="item.items"
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
    shouldShowItem(item) {
      return (
        this.shouldRenderSchema(item) && (
          !item.items ||
          Object.values(item.items).some(this.shouldRenderSchema)
        )
      )
    },

    onResize({ contentRect: { width } }) {
      if (width) {
        this.width = width
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
  $self: &;
  $item-height: $menu-font-size + 2 * $menu-padding-ver;

  --menu-active-color: #{$color-white};
  --menu-active-background: #{$color-active};

  border-right: $border-style;
  padding: 0 $menu-spacing;

  &__item {
    &:has(#{$self}__sub):not(:has(#{$self}__link--active)) {
      // Pop-out sub-menus on hover:
      &:hover {
        > #{$self}__link {
          background: $color-lightest;
        }

        #{$self}__sub {
          display: block;
          position: absolute;
          width: var(--width);
          z-index: $z-index-header;
          transform: translateX(calc(var(--width) + 2 * $menu-spacing))
            translateY(-$item-height);

          #{$self}__item:first-child {
            #{$self}__link {
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

        #{$self}__sub {
          box-shadow: $shadow-window;
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

    &:focus:not(:active, &--active) {
      box-shadow: $shadow-focus;
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
