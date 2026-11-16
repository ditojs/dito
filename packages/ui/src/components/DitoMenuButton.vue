<template lang="pug">
DropdownMenuRoot(:modal="false")
  DropdownMenuTrigger(
    asChild
    :disabled="disabled"
  )
    DitoButton.dito-menu-button(
      v-bind="$attrs"
      :disabled="disabled"
    )
      slot
  //- No portal, so that the styles apply. The menu is fixed, so that
  //- scrolling panels don't clip it:
  DropdownMenuContent.dito-menu-button__menu(
    :side="side"
    :align="align"
    :sideOffset="4"
    loop
    positionStrategy="fixed"
  )
    DropdownMenuArrow.dito-menu-button__tip(
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

// A button that opens a menu of `items`, built on reka-ui's `DropdownMenu`,
// and emits `select` with the chosen item, see `docs/api/ui.md`. Attributes go
// to the button.
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
    // Where the menu opens, as in reka-ui's `DropdownMenuContent`:
    side: { type: String, default: 'bottom' },
    align: { type: String, default: 'start' },
    disabled: { type: Boolean, default: false }
  }
}
</script>

<style lang="scss">
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

  &[data-state='open'] {
    animation: dito-slide-enter 0.15s $ease-out-quart;
  }
}

.dito-menu-button__tip {
  fill: $button-color;
}

.dito-menu-button__item {
  @extend %button--plain;

  display: block;
  width: 100%;
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
