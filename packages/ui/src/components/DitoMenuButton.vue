<template lang="pug">
DitoTrigger.dito-menu-button(
  v-model:show="isOpen"
  trigger="click"
  :placement="placement"
  :disabled="disabled"
  :matchTargetWidth="false"
  :cover="cover"
  :transition="null"
  :class="{ 'dito-menu-button--open': isOpen }"
)
  template(#trigger)
    DitoButton(
      ref="button"
      aria-haspopup="menu"
      :aria-expanded="isOpen ? 'true' : 'false'"
      :disabled="disabled"
      v-bind="$attrs"
      @keydown="onButtonKeyDown"
      @keyup="onKeyUp"
    )
      slot
  template(#popup)
    ul.dito-menu-button__menu(
      role="menu"
      @keydown="onMenuKeyDown"
      @keyup="onKeyUp"
    )
      li(
        v-for="item in items"
        :key="item.value"
        role="none"
      )
        button.dito-menu-button__item(
          :ref="element => setItemElement(item, element)"
          type="button"
          role="menuitem"
          tabindex="-1"
          :aria-disabled="item.disabled ? 'true' : null"
          :class="{ 'dito-menu-button__item--disabled': item.disabled }"
          @click="selectItem(item)"
        ) {{ item.label }}
</template>

<script>
import DitoTrigger from './DitoTrigger.vue'
import DitoButton from './DitoButton.vue'

// A button that opens a menu of `items`, each `{ value, label, disabled }`,
// and emits `select` with the item that is chosen, by mouse or keyboard.
// Attributes, e.g. `class` or the `verb` and `text` of `DitoButton`, go to the
// button, its content to the default slot.
export default {
  components: { DitoTrigger, DitoButton },
  inheritAttrs: false,
  emits: ['select'],

  props: {
    items: { type: Array, required: true },
    placement: { type: String, default: 'bottom' },
    // Whether the menu opens over the button, like native menus do.
    cover: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false }
  },

  data() {
    return {
      isOpen: false
    }
  },

  created() {
    // The elements of the rendered items, by item.
    this.itemElements = new Map()
  },

  methods: {
    setItemElement(item, element) {
      if (element) {
        this.itemElements.set(item, element)
      } else {
        this.itemElements.delete(item)
      }
    },

    getFocusedItemIndex() {
      return this.items.findIndex(
        item => this.itemElements.get(item) === document.activeElement
      )
    },

    focusItemAt(index) {
      this.itemElements.get(this.items[index])?.focus()
    },

    async open(focusIndex) {
      this.isOpen = true
      // Wait for the menu to be rendered, so its items can be focused.
      await this.$nextTick()
      this.focusItemAt(focusIndex)
    },

    close() {
      this.isOpen = false
      this.focusButton()
    },

    focusButton() {
      this.$refs.button.$el.focus()
    },

    selectItem(item) {
      if (!item.disabled) {
        this.close()
        this.$emit('select', item)
      }
    },

    onButtonKeyDown(event) {
      const { key } = event
      if (key === 'Enter' || key === ' ' || key === 'ArrowDown') {
        event.preventDefault()
        this.open(0)
      } else if (key === 'ArrowUp') {
        event.preventDefault()
        this.open(this.items.length - 1)
      }
    },

    onMenuKeyDown(event) {
      const { key } = event
      const count = this.items.length
      const index = this.getFocusedItemIndex()
      if (key === 'Escape') {
        // `DitoTrigger` closes the menu, return the focus to the button.
        this.focusButton()
      } else if (key === 'Enter' || key === ' ') {
        event.preventDefault()
        const item = this.items[index]
        if (item) {
          this.selectItem(item)
        }
      } else if (key === 'Tab') {
        // Let the focus move on as usual, but close the menu.
        this.isOpen = false
      } else {
        const targetIndex = {
          ArrowDown: (index + 1) % count,
          ArrowUp: (index - 1 + count) % count,
          Home: 0,
          End: count - 1
        }[key]
        if (targetIndex !== undefined) {
          event.preventDefault()
          this.focusItemAt(targetIndex)
        }
      }
    },

    onKeyUp(event) {
      // Firefox clicks buttons on the keyup of Space even if its keydown was
      // prevented, which would toggle the menu again or select an item, see
      // `onButtonKeyDown()` and `onMenuKeyDown()`.
      if (event.key === ' ') {
        event.preventDefault()
      }
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

$menu-button-radius: 0.5em;
$menu-button-padding: 0.5em 1em;

.dito-menu-button {
  display: inline-block;

  &__menu {
    // Lets the menu open below the top of the button, e.g. to line up with
    // text inside a taller button:
    margin: var(--dito-menu-button-offset, 0) 0 0;
    padding: 0;
    list-style: none;
    border-radius: $menu-button-radius;
    box-shadow: $shadow-window;
    overflow: hidden;
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

    &--disabled {
      color: $color-disabled;
      cursor: default;
    }

    &:not(&--disabled):is(:hover, :focus-visible) {
      background: $color-active;
      color: $color-white;
      outline: none;
    }
  }
}
</style>
