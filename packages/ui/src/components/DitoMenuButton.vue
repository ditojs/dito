<template lang="pug">
.dito-menu-button(
  :class=`{
    'dito-menu-button--open': isOpen,
    'dito-menu-button--attached': isAttached,
    'dito-menu-button--floating': floating,
    'dito-menu-button--offset': offset
  }`
)
  DropdownMenuRoot(
    v-model:open="isOpen"
    :modal="false"
  )
    //- Passes `disabled` on to the button:
    DropdownMenuTrigger(
      asChild
      :disabled="disabled"
    )
      DitoButton(
        ref="button"
        v-bind="$attrs"
        @keydown="onButtonKeyDown"
      )
        slot
    //- No portal, so that the menu's styles apply. The menu is fixed, so that
    //- scrolling panels don't clip it:
    DropdownMenuContent.dito-menu-button__menu(
      ref="menu"
      :side="sideAndAlign.side"
      :align="sideAndAlign.align"
      :sideOffset="sideOffset"
      loop
      positionStrategy="fixed"
      @open-auto-focus="onOpenAutoFocus"
    )
      DropdownMenuArrow.dito-menu-button__tip(
        v-if="floating"
        :width="14"
        :height="7"
      )
      DropdownMenuItem.dito-menu-button__item(
        v-for="item in items"
        :key="item.value"
        as="button"
        type="button"
        :disabled="item.disabled"
        :title="item.icon ? item.label : null"
        :class="{ 'dito-menu-button__item--icon': item.icon }"
        @select="$emit('select', item)"
      )
        DitoIcon(
          v-if="item.icon"
          :name="item.icon"
        )
        template(
          v-else
        ) {{ item.label }}
</template>

<script>
import {
  DropdownMenuArrow,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import DitoButton from './DitoButton.vue'
import DitoIcon from './DitoIcon.vue'
import { getSideAndAlign } from '../utils/trigger'

// A button that opens a menu of `items` and emits `select` with the chosen
// one, see `docs/api/ui.md`. Attributes go to the button.
export default {
  components: {
    DropdownMenuArrow,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuTrigger,
    DitoButton,
    DitoIcon
  },
  inheritAttrs: false,
  emits: ['select'],

  props: {
    items: { type: Array, required: true },
    placement: { type: String, default: 'bottom' },
    // Whether the menu opens over the button, like native menus do, or else
    // attached below it, with the width of the wider of the two.
    cover: { type: Boolean, default: true },
    // Whether the menu opens below the button as a separate panel, which
    // overrides `cover`.
    floating: { type: Boolean, default: false },
    // Whether the menu opens one item padding below the top of the button,
    // e.g. to line up with text inside a taller button.
    offset: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false }
  },

  data() {
    return {
      isOpen: false,
      buttonHeight: 0,
      // Whether ArrowUp opened the menu, which then focuses its last item.
      focusLast: false
    }
  },

  computed: {
    isAttached() {
      return !this.cover && !this.floating
    },

    sideAndAlign() {
      return getSideAndAlign(this.placement)
    },

    sideOffset() {
      // Covering menus move back over the button:
      return this.cover && !this.floating ? -this.buttonHeight : 0
    }
  },

  watch: {
    async isOpen(isOpen) {
      const button = this.$refs.button.$el
      if (isOpen) {
        this.buttonHeight = button.getBoundingClientRect().height
      } else {
        this.focusLast = false
      }
      if (this.isAttached) {
        Object.assign(button.style, {
          minWidth: '',
          marginLeft: '',
          marginRight: ''
        })
        if (isOpen) {
          await this.$nextTick()
          const menu = this.$refs.menu.$el
          const buttonWidth = button.getBoundingClientRect().width
          const menuWidth = menu.getBoundingClientRect().width
          const width = Math.max(buttonWidth, menuWidth)
          button.style.minWidth = menu.style.minWidth = `${width}px`
          // Grow the button towards the menu without moving what's around it:
          const side =
            this.sideAndAlign.align === 'end' ? 'marginLeft' : 'marginRight'
          button.style[side] = `${buttonWidth - width}px`
        }
      }
    }
  },

  methods: {
    onButtonKeyDown(event) {
      // reka-ui opens the menu with Enter, Space and ArrowDown and focuses the
      // first item. ArrowUp opens it at the last item:
      if (event.key === 'ArrowUp' && !this.disabled) {
        event.preventDefault()
        this.focusLast = true
        this.isOpen = true
      }
    },

    onOpenAutoFocus(event) {
      if (this.focusLast) {
        event.preventDefault()
        const items = event.target.querySelectorAll(
          '[role="menuitem"]:not([data-disabled])'
        )
        items[items.length - 1]?.focus()
      }
    }
  }
}
</script>

<style lang="scss">
@use 'sass:list';
@import '../styles/_imports';

$menu-button-radius: 0.5em;
$menu-button-padding-ver: 0.5em;
$menu-button-padding: $menu-button-padding-ver 1em;

.dito-menu-button {
  display: inline-block;

  &__menu {
    // reka-ui gives the menu's z-index to the element that positions it:
    z-index: $z-index-popup;
    border-radius: $menu-button-radius;
    box-shadow: $shadow-window;
    overflow: hidden;
  }

  // Join the attached menu and its button into one shape, and cut off the
  // shadow at the button, so the menu doesn't float above it:
  &--attached#{&}--open .dito-button {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  &--attached &__menu {
    $blur: list.nth($shadow-window, 3);
    // The radius of the buttons that attached menus join:
    $radius: 2 * $border-radius;

    border-radius: 0 0 $radius $radius;
    clip-path: inset(0 (-$blur) (-2 * $blur));
  }

  &--offset &__menu {
    margin-top: $menu-button-padding-ver;
  }

  &--floating {
    $padding: 0.25em;

    // reka-ui places the tip at the menu's edge, in the middle of the button:
    .dito-menu-button__tip {
      fill: $button-color;
    }

    .dito-menu-button__menu {
      padding: $padding;
      background: $button-color;
      // Show the tip outside the menu:
      overflow: visible;
    }

    .dito-menu-button__item {
      // Concentric with the menu's corners, around its padding:
      border-radius: $menu-button-radius - $padding;

      &:not(.dito-menu-button__item--icon) {
        padding: 0.6em 1em;
      }
    }
  }

  &__item {
    display: block;
    width: 100%;
    padding: $menu-button-padding;
    border: 0;
    font: inherit;
    line-height: 1;
    text-align: left;
    white-space: nowrap;
    color: inherit;
    background: $button-color;
    @include user-select(none);

    &--icon {
      // Show only the icon, in a square:
      display: flex;
      padding: $menu-button-padding-ver;
    }

    &[data-disabled] {
      color: $color-disabled;
      cursor: default;
    }

    &[data-highlighted] {
      background: $color-active;
      color: $color-white;
      outline: none;
    }
  }
}
</style>
