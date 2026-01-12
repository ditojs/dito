<template lang="pug">
component.dito-label(
  v-if="text || collapsible"
  :is="collapsible ? 'button' : 'div'"
  :type="collapsible ? 'button' : null"
  v-bind="attributes"
  :class="{ 'dito-label--active': isActive }"
)
  .dito-chevron(
    v-if="collapsible"
    :class="{ 'dito-chevron--open': !collapsed }"
  )
  .dito-label__inner(
    v-if="text || prefixes.length > 0 || suffixes.length > 0"
  )
    DitoAffixes(
      :items="prefixes"
      position="prefix"
      :parentContext="context"
    )
    label(
      v-if="text"
      :for="dataPath"
      v-html="text"
    )
    DitoAffixes(
      :items="suffixes"
      mode="ellipsis"
      position="suffix"
      :parentContext="context"
    )
    .dito-info(
      v-if="info"
      :data-info="info"
    )
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import DitoAffixes from './DitoAffixes.vue'
import { isObject, asArray } from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('DitoLabel', {
  components: { DitoAffixes },

  emits: ['open'],

  props: {
    label: { type: [String, Object], default: null },
    dataPath: { type: String, default: null },
    collapsed: { type: Boolean, default: false },
    collapsible: { type: Boolean, default: false },
    info: { type: String, default: null }
  },

  computed: {
    text() {
      const { label } = this
      return isObject(label) ? label?.text : label
    },

    prefixes() {
      return asArray(this.label?.prefix)
    },

    suffixes() {
      return asArray(this.label?.suffix)
    },

    attributes() {
      return this.collapsible ? { onClick: this.onClick } : {}
    },

    isActive() {
      return this.appState.activeLabel === this
    }
  },

  methods: {
    onClick() {
      this.appState.activeLabel = this
      this.$emit('open', this.collapsed)
    }
  }
})
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
  min-height: $input-height;
  margin-right: $form-spacing-half; // When inlined.

  &:has(.dito-schema-header) {
    // The container's label is used as teleport for a nested section or object
    // label. Hide `&__inner`, as it is be duplicated inside the nested label.
    > #{$self}__inner {
      display: none;
    }
  }

  &:not(:has(+ .dito-tabs)) {
    // Take full width but only if there aren't also tabs to be centered.
    flex: 1;
  }

  &__inner {
    flex: 1 0 0%;
    display: flex;
    align-items: center;
    overflow: hidden;
    gap: $input-padding-hor;
  }

  label {
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

  .dito-buttons {
    // Move the label padding inside .dito-buttons, so that it captures all
    // near mouse events:
    margin: calc(-1 * var(--label-padding));
    margin-left: 0;
    padding: var(--label-padding);
  }

  &--fill {
    width: 100%;

    // In order for ellipsis to work on labels without affecting other layout,
    // we need to position it absolutely inside its container. But we can only
    // do so if there is't also a chevron or other UX elements besides it.
    &:has(> #{$self}__inner:only-child) {
      flex: 1; // When in `.dito-schema-header`.

      > #{$self}__inner {
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

  @at-root button#{&} {
    border: 0;
    padding: 0;
    background: none;
    text-align: start;

    &:hover {
      .dito-chevron {
        color: $color-darker;
      }
    }

    &:focus:not(:active, &--active) {
      .dito-chevron {
        -webkit-text-stroke: $border-width $color-active;
      }
    }
  }
}
</style>
