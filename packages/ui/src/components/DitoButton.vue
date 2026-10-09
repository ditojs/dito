<template lang="pug">
component.dito-button(
  :is="as"
  :type="isNativeButton ? type : null"
  :disabled="isNativeButton ? disabled : null"
  :aria-disabled="isAriaDisabled ? 'true' : null"
  :tabindex="isAriaDisabled ? -1 : null"
  :title="title ?? verbAttributes.title"
  :aria-label="verbAttributes['aria-label']"
  :class=`[
    classes,
    verbAttributes.class,
    {
      'dito-button--affixed': hasAffixes,
      'dito-button--disabled': isAriaDisabled
    }
  ]`
  v-bind="attributes"
  @click.capture="onClickCapture"
)
  template(
    v-if="text || hasAffixes"
  )
    .dito-button__prefix(
      v-if="hasAffixes"
    )
      slot(name="prefix")
    .dito-button__text {{ text || '' }}
      slot
    .dito-button__suffix(
      v-if="hasAffixes"
    )
      slot(name="suffix")
  slot(
    v-else
  )
</template>

<script>
import { Comment } from 'vue'
import { isArray, isString, asArray } from '@ditojs/utils'
import { hasSlotContent } from '../utils/vue.js'
import { getVerbButtonAttributes } from '../utils/button.js'

// Returns whether `vnodes` render text, also inside elements and fragments,
// e.g. the slots that `DitoMenuButton` forwards, which render as fragments also
// when empty. Components and their slots aren't searched, so that buttons that
// only display icons are still labelled by their verb.
function hasVNodeText(vnodes) {
  return asArray(vnodes).some(vnode =>
    isString(vnode)
      ? vnode.trim() !== ''
      : !!vnode &&
        vnode.type !== Comment && (
          isString(vnode.children)
            ? vnode.children.trim() !== ''
            : isArray(vnode.children) && hasVNodeText(vnode.children)
        )
  )
}

// Renders all buttons, so that they're of `type="button"` unless stated
// otherwise and not accidentally submit their forms.
export default {
  inheritAttrs: false,

  props: {
    // The element or component to render, e.g. 'a' or 'RouterLink' for links
    // styled as buttons, which are disabled through `aria-disabled`.
    as: { type: [String, Object], default: 'button' },
    type: { type: String, default: 'button' },
    text: { type: String, default: null },
    title: { type: String, default: null },
    disabled: { type: Boolean, default: false },
    // The verb that the button performs, e.g. 'delete', which styles it and
    // labels it when it doesn't display text, along with its `subject`.
    verb: { type: String, default: null },
    subject: { type: String, default: null }
  },

  computed: {
    isNativeButton() {
      return this.as === 'button'
    },

    isAriaDisabled() {
      return this.disabled && !this.isNativeButton
    },

    verbAttributes() {
      const { verb, subject, hasText } = this
      return verb ? getVerbButtonAttributes({ verb, subject, hasText }) : {}
    },

    // Whether the button displays text, through `text` or its default slot.
    hasText() {
      return !!this.text || hasVNodeText(this.$slots.default?.())
    },

    hasAffixes() {
      return (
        hasSlotContent(this.$slots.prefix) ||
        hasSlotContent(this.$slots.suffix)
      )
    },

    classes() {
      return this.$attrs.class
    },

    attributes() {
      const { class: _, ...attributes } = this.$attrs
      return attributes
    }
  },

  methods: {
    onClickCapture(event) {
      // Disabled links don't navigate nor reach the click handlers of their
      // owners, like disabled native buttons. Capture listeners on the target
      // run before all others, e.g. the navigation of `RouterLink`.
      if (this.isAriaDisabled) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    }
  }
}
</script>
