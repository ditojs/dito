<template lang="pug">
.dito-time-input(:class="$attrs.class")
  PopoverRoot(
    v-model:open="open"
  )
    //- The popup is placed at the field, not at its button:
    PopoverAnchor(asChild)
      //- The attributes but `class` go to the field, also the other props of
      //- `reka-ui`'s `TimeFieldRoot`:
      TimeFieldRoot.dito-input(
        v-slot="{ segments }"
        v-bind="{ ...$props, ...attributes }"
        :class="inputClasses"
        @update:modelValue="value => $emit('update:modelValue', value ?? null)"
        @focusin="onPartFocus"
        @focusout="onFocusOut"
        @click="onPartFocus"
      )
        slot(name="prefix")
        .dito-date-segments(ref="segments")
          TimeFieldInput.dito-date-segments__part(
            v-for="item in segments"
            :key="item.part"
            :part="item.part"
          ) {{ item.value }}
        PopoverTrigger.dito-time-input__toggle(
          aria-label="Choose time"
          :disabled="disabled || readonly"
        )
          DitoIcon(
            name="clock"
            :disabled="disabled"
          )
        slot(name="suffix")
    //- Fixed, so that scrolling panels don't clip it, and without a portal, so
    //- that the styles apply:
    PopoverContent.dito-time-input__popup(
      align="start"
      :sideOffset="2"
      :collisionBoundary="scrollContainer"
      positionStrategy="fixed"
      @open-auto-focus="onOpenAutoFocus"
      @close-auto-focus="onCloseAutoFocus"
      @interact-outside="onInteractOutside"
    )
      DitoTimePanel(
        :modelValue="panelValue"
        :granularity="granularity"
        @update:modelValue="value => $emit('update:modelValue', value)"
        @select="focusPart"
      )
</template>

<script>
import { Time } from '@internationalized/date'
import {
  PopoverAnchor,
  PopoverContent,
  PopoverRoot,
  PopoverTrigger,
  TimeFieldInput,
  TimeFieldRoot
} from 'reka-ui'
import DitoIcon from './DitoIcon.vue'
import DitoTimePanel from './DitoTimePanel.vue'
import { getScrollContainer, hasErrors } from '../utils/element.js'

// A time field with the lists of `DitoTimePanel` in a popup, built on
// reka-ui's `TimeField`.
export default {
  components: {
    PopoverAnchor,
    PopoverContent,
    PopoverRoot,
    PopoverTrigger,
    TimeFieldInput,
    TimeFieldRoot,
    DitoIcon,
    DitoTimePanel
  },
  inheritAttrs: false,
  emits: ['update:modelValue'],

  // The props of `TimeFieldRoot` that the field reads:
  props: {
    modelValue: { type: Object, default: null },
    granularity: { type: String, default: 'minute' },
    hourCycle: { type: Number, default: undefined },
    locale: { type: String, default: 'en-US' },
    // The value that typing and picking start from without a value:
    defaultPlaceholder: { type: Object, default: undefined },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false }
  },

  data() {
    return {
      open: false,
      scrollContainer: null
    }
  },

  computed: {
    inputClasses() {
      return {
        'dito-input--has-errors': hasErrors(this.$attrs),
        'dito-input--disabled': this.disabled,
        // The field looks focused while its popup is open:
        'dito-input--focus': this.open
      }
    },

    attributes() {
      const { class: _, ...attributes } = this.$attrs
      return attributes
    },

    panelValue() {
      return this.modelValue ?? this.defaultPlaceholder ?? new Time()
    }
  },

  mounted() {
    this.scrollContainer = getScrollContainer(this.$el)
  },

  methods: {
    // Focusing or clicking a part opens the popup, also after it was closed
    // while the part kept the focus:
    onPartFocus(event) {
      if (event.target.matches('[contenteditable="true"]')) {
        this.open = true
      }
    },

    // reka-ui focuses the popup when it opens, and the button when it closes,
    // which a focused part prevents. The button opens it with the focus in the
    // first part instead:
    onOpenAutoFocus(event) {
      event.preventDefault()
      if (!this.hasFocusedPart()) {
        this.focus()
      }
    },

    onCloseAutoFocus(event) {
      if (this.hasFocusedPart()) {
        event.preventDefault()
      }
    },

    // Clicks on the field and the focus moving between its parts keep the
    // popup open:
    onInteractOutside(event) {
      const { target } = event
      if (this.$el.contains(target) && !target.closest('button')) {
        event.preventDefault()
      }
    },

    hasFocusedPart() {
      return !!this.$el.querySelector('[contenteditable="true"]:focus')
    },

    // Show the start of clipped parts again once the focus leaves the field,
    // as inputs do:
    onFocusOut(event) {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        this.$refs.segments.scrollLeft = 0
      }
    },

    // The part that was picked in the panel becomes the focused one:
    focusPart(name) {
      this.$el.querySelector(`[data-reka-time-field-segment="${name}"]`).focus()
    },

    focus() {
      this.$el.querySelector('[contenteditable="true"]')?.focus()
    },

    blur() {
      this.$el.querySelector(':focus')?.blur()
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-time-input {
  .dito-input {
    display: flex;
    min-width: 6em;
  }

  &__toggle {
    @extend %button--plain;

    display: flex;
  }

  &__popup {
    @extend %popup--animated;
  }
}
</style>
