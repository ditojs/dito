<template lang="pug">
DropdownMenuRoot(
  :modal="false"
  @update:open="onUpdateOpen"
)
  DropdownMenuTrigger(
    asChild
    :disabled="disabled"
  )
    DitoButton.dito-menu-button(
      ref="button"
      :class="{ 'dito-menu-button--attached': attached }"
      v-bind="$attrs"
    )
      slot
  //- No portal, so that the styles apply. The menu is fixed, so that
  //- scrolling panels don't clip it:
  DropdownMenuContent.dito-menu-button__menu(
    ref="menu"
    :class="{ 'dito-menu-button__menu--attached': attached }"
    :side="side"
    :align="alignment"
    :sideOffset="attached ? 0 : 4"
    :collisionBoundary="scrollContainer"
    loop
    positionStrategy="fixed"
  )
    DropdownMenuItem.dito-menu-button__item(
      v-for="item in items"
      :key="item.value"
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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import DitoButton from './DitoButton.vue'
import DitoIcon from './DitoIcon.vue'
import { getScrollContainer } from '../utils/element.js'

// A button that opens a menu of `items`, built on reka-ui's `DropdownMenu`,
// and emits `select` with the chosen item. Attributes go to the button.
export default {
  components: {
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
    // Where the menu opens, as in reka-ui's `DropdownMenuContent`:
    side: { type: String, default: 'bottom' },
    align: { type: String, default: 'center' },
    // Join the menu and the button into one shape, as wide as the wider of
    // the two:
    attached: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false }
  },

  data() {
    return { scrollContainer: null, alignment: this.align }
  },

  mounted() {
    // Keep the menu in the closest container that scrolls, out of the headers
    // above it:
    this.scrollContainer = getScrollContainer(this.$refs.button.$el)
  },

  methods: {
    async onUpdateOpen(open) {
      this.alignment = this.align
      if (open && this.align === 'center' && /top|bottom/.test(this.side)) {
        // reka-ui's flip never leaves `center`, so a centered menu that
        // doesn't fit aligns with the button's edge on that side. reka-ui
        // positions the menu in microtasks, so this runs before it shows:
        await this.$nextTick()
        const { offsetWidth: width } = this.$refs.menu.$el
        const button = this.$refs.button.$el.getBoundingClientRect()
        const { left, right } =
          this.scrollContainer?.getBoundingClientRect() ?? {
            left: 0,
            right: document.documentElement.clientWidth
          }
        const center = (button.left + button.right) / 2
        this.alignment =
          center + width / 2 > right
            ? 'end'
            : center - width / 2 < left
              ? 'start'
              : 'center'
      }
    }
  }
}
</script>

<style lang="scss">
@use 'sass:list';
@import '../styles/_imports';

$menu-button-radius: 0.5em;
$menu-button-padding: 0.25em;

.dito-menu-button__menu {
  // reka-ui gives the menu's z-index to the element that positions it:
  z-index: $z-index-popup;
  padding: $menu-button-padding;
  border-radius: $menu-button-radius;
  background: $button-color;
  box-shadow: $shadow-window;
  // Fit long menus into the room that reka-ui measures, and scroll them
  // only vertically, also when a scrollbar narrows the items:
  box-sizing: border-box;
  max-width: var(--reka-dropdown-menu-content-available-width);
  max-height: var(--reka-dropdown-menu-content-available-height);
  overflow: hidden auto;

  &[data-state='open'] {
    animation: dito-slide-enter 0.15s $ease-out-quart;
  }
}

// Attached menus continue their open button, without a shadow over it:
.dito-menu-button--attached[data-state='open'] {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.dito-menu-button__menu--attached {
  $blur: list.nth($shadow-window, 3);
  // The radius of the buttons that attached menus join:
  $radius: 2 * $border-radius;

  min-width: var(--reka-dropdown-menu-trigger-width);
  padding: 0;
  border-radius: 0 0 $radius $radius;
  clip-path: inset(0 (-$blur) (-2 * $blur));

  .dito-menu-button__item {
    justify-content: center;
    border-radius: 0;
  }
}

.dito-menu-button__item {
  @extend %button--plain;

  display: block;
  padding: 0.6em 1em;
  // Concentric with the menu's corners, around its padding:
  border-radius: $menu-button-radius - $menu-button-padding;
  line-height: 1;
  text-align: left;
  white-space: nowrap;
  @include user-select(none);

  &--icon {
    // Show only the icon, in a square:
    display: flex;
    padding: 0.5em;
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
</style>
