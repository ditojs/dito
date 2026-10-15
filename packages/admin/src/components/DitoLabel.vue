<template lang="pug">
component.dito-label(
  v-if="hasContent || collapsible"
  :is="collapsible ? 'button' : 'div'"
  :type="collapsible ? 'button' : null"
  v-bind="attributes"
)
  //- Type components teleport their buttons here, see `DitoLabelButtons`:
  .dito-label__buttons.dito-label__buttons--start(
    v-if="hasButtons"
  )
  //- The chevron and the text, which the focus ring of toggles encloses:
  .dito-label__content
    .dito-chevron(
      v-if="collapsible"
      :class="{ 'dito-chevron--open': !collapsed }"
    )
    .dito-label__inner(
      v-if="hasContent || prefixes.length > 0 || suffixes.length > 0"
    )
      DitoAffixes(
        :items="prefixes"
        position="prefix"
        :parentContext="context"
      )
      label(
        v-if="content.text"
        :for="htmlFor"
      ) {{ content.text }}
      label(
        v-else-if="content.html"
        :for="htmlFor"
        v-html="content.html"
      )
      DitoAffixes(
        :items="suffixes"
        mode="ellipsis"
        position="suffix"
        :parentContext="context"
      )
      DitoInfo(
        v-if="info"
        :info="info"
      )
  .dito-label__buttons.dito-label__buttons--end(
    v-if="hasButtons"
  )
</template>

<script>
import { computed } from 'vue'
import { isObject, asArray } from '@ditojs/utils'
import DitoAffixes from './DitoAffixes.vue'
import DitoInfo from './DitoInfo.vue'

export default {
  components: { DitoAffixes, DitoInfo },
  emits: ['toggle'],

  props: {
    // Text, or `{ text | html, prefix, suffix }`:
    label: { type: [String, Object], default: null },
    // For the callbacks of the affixes:
    context: { type: Object, required: true },
    htmlFor: { type: String, default: null },
    collapsed: { type: Boolean, default: false },
    collapsible: { type: Boolean, default: false },
    info: { type: [String, Object], default: null },
    hasButtons: { type: Boolean, default: false }
  },

  setup(props, { emit }) {
    const content = computed(() =>
      isObject(props.label) ? props.label : { text: props.label }
    )
    return {
      content,
      hasContent: computed(() => !!(content.value.text || content.value.html)),
      prefixes: computed(() => asArray(props.label?.prefix)),
      suffixes: computed(() => asArray(props.label?.suffix)),
      attributes: computed(() =>
        props.collapsible
          ? {
              'onClick': () => emit('toggle', !props.collapsed),
              'aria-expanded': !props.collapsed
            }
          : {}
      )
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-label {
  $self: &;

  // For buttons and chevron to align right:
  display: flex;
  position: relative;
  // Vertically center all items in the label, e.g. chevron, edit-buttons.
  align-items: center;
  // Let nested labels with ellipsis shrink below their content width.
  min-width: 0;
  min-height: $input-height;
  margin-right: $form-spacing-half; // When inlined.

  &:not(:has(+ .dito-tabs)) {
    // Take full width but only if there aren't also tabs to be centered.
    flex: 1;
  }

  &__content {
    display: contents;
  }

  &__inner {
    flex: 1 0 0%;
    display: flex;
    align-items: center;
    overflow: hidden;
    gap: $input-padding-hor;
  }

  label {
    @include ellipsis;

    cursor: inherit;
    font-weight: bold;
    line-height: $input-height;
  }

  // Fix alignment of sub and sup elements in label content.
  sub,
  sup {
    display: inline-block;
    vertical-align: baseline;
  }

  sub {
    transform: translateY(4px);
  }

  sup {
    transform: translateY(-4px);
  }

  &--fill {
    width: 100%;

    // In order for ellipsis to work on labels without affecting other layout,
    // we need to position it absolutely inside its container. But we can only
    // do so if there is't also a chevron or other UX elements besides it.
    &:has(> #{$self}__content:only-child > #{$self}__inner:only-child) {
      flex: 1; // When in `.dito-schema-header`.

      > #{$self}__content > #{$self}__inner {
        position: absolute;
        inset: 0;
      }
    }

    &::after {
      // Since <label> uses `position: absolute`, set content to a zero-width
      // space on its parent to enforce the right text height in the container
      content: '\200b'; // zero-width space;
    }
  }

  .dito-info {
    margin-left: 0.35em;
  }

  // Buttons precede the text of the label, or sit at its end:
  &__buttons {
    display: flex;

    &--end {
      margin-left: auto;
    }
  }

  @at-root button#{&} {
    border: 0;
    padding: 0;
    background: none;
    text-align: start;

    // The whole label toggles, but the focus ring only encloses its content,
    // padded for it:
    > #{$self}__content {
      display: flex;
      align-items: center;
      position: relative;
      min-width: 0;
      padding: 0 $focus-ring-padding;
      margin-left: -$focus-ring-padding;

      > #{$self}__inner {
        flex: 0 1 auto;
      }
    }

    &:hover {
      .dito-chevron {
        color: $color-darker;
      }
    }

    &:focus-visible {
      outline: none;

      > #{$self}__content {
        @include focus-ring-line;
      }
    }
  }
}
</style>
