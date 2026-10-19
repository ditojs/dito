<template lang="pug">
DitoTrigger.dito-menu-button(
  v-model:show="isOpen"
  trigger="click"
  :placement="placement"
  :disabled="disabled"
  :matchTargetWidth="false"
  :cover="cover && !floating"
  :transition="null"
  :class=`{
    'dito-menu-button--open': isOpen,
    'dito-menu-button--attached': isAttached,
    'dito-menu-button--floating': floating,
    'dito-menu-button--offset': offset
  }`
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
      ref="menu"
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
          :aria-disabled="item.disabled ? 'true' : null"
          :title="item.icon ? item.label : null"
          :class=`{
            'dito-menu-button__item--icon': item.icon,
            'dito-menu-button__item--disabled': item.disabled
          }`
          @click="selectItem(item)"
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
import DitoTrigger from './DitoTrigger.vue'
import DitoButton from './DitoButton.vue'
import DitoIcon from './DitoIcon.vue'

// A button that opens a menu of `items`, each `{ value, label, disabled }`,
// and emits `select` with the item that is chosen, by mouse or keyboard.
// Items with an `icon` show it instead of their label, which becomes their
// title.
// Attributes, e.g. `class` or the `verb` and `text` of `DitoButton`, go to the
// button, its content to the default slot.
export default {
  components: { DitoTrigger, DitoButton, DitoIcon },
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
      isOpen: false
    }
  },

  computed: {
    isAttached() {
      return !this.cover && !this.floating
    }
  },

  watch: {
    async isOpen(isOpen) {
      if (this.isAttached) {
        const button = this.$refs.button.$el
        Object.assign(button.style, {
          minWidth: '',
          marginLeft: '',
          marginRight: ''
        })
        if (isOpen) {
          await this.$nextTick()
          const { menu } = this.$refs
          const buttonWidth = getWidth(button)
          const width = Math.max(buttonWidth, getWidth(menu))
          button.style.minWidth = menu.style.minWidth = `${width}px`
          // Grow the button towards the menu without moving what's around it:
          const side = this.placement.endsWith('-right')
            ? 'marginLeft'
            : 'marginRight'
          button.style[side] = `${buttonWidth - width}px`
        }
      }
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
        // Tab through the items, which follow the button, and close the menu
        // once the focus leaves them:
        if (event.shiftKey ? index === 0 : index === count - 1) {
          this.isOpen = false
        }
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

function getWidth(element) {
  return element.getBoundingClientRect().width
}
</script>

<style lang="scss">
@use 'sass:list';
@use 'sass:math';
@import '../styles/_imports';

$menu-button-radius: 0.5em;
$menu-button-padding-ver: 0.5em;
$menu-button-padding: $menu-button-padding-ver 1em;

.dito-menu-button {
  display: inline-block;

  &__menu {
    margin: 0;
    padding: 0;
    list-style: none;
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
    $tip-size: 0.5em;
    $tip-side: $tip-size * math.sqrt(2);
    $padding: 0.25em;

    .dito-popup {
      margin-top: math.div(-$tip-size, 2);
      padding-top: $tip-size;

      // The tip pointing at the button, a square half hidden by the menu,
      // which casts its own shadow:
      &::before {
        content: '';
        position: absolute;
        top: $tip-size - math.div($tip-side, 2);
        left: 1.5em;
        width: $tip-side;
        height: $tip-side;
        background: $button-color;
        box-shadow: $shadow-window;
        transform: rotate(45deg);
      }

      // Keep the tip near the edge that lines up with the button:
      &--bottom-right::before {
        left: auto;
        right: 1.5em;
      }

      // ...or at the middle of the button, also when kept in the window:
      &--bottom-center::before {
        left: calc(50% - #{math.div($tip-side, 2)} - var(--dito-popup-shift));
      }
    }

    .dito-menu-button__menu {
      position: relative;
      padding: $padding;
      background: $button-color;
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
