<template lang="pug">
component.dito-label(
  v-if="text || collapsible"
  :is="tag"
  v-bind="attributes"
  :class="{ 'dito-active': isActive }"
)
  .dito-chevron(
    v-if="collapsible"
    :class="{ 'dito-opened': !collapsed }"
  )
  .dito-label__inner(
    v-if="text || prefixes.length > 0 || suffixes.length > 0"
  )
    DitoElement.dito-label__prefix(
      v-for="(prefix, index) of prefixes"
      :key="`prefix-${index}`"
      tag="span"
      :content="prefix"
    )
    label(
      v-if="text"
      :for="dataPath"
      v-html="text"
    )
    DitoElement.dito-label__suffix(
      v-for="(suffix, index) of suffixes"
      :key="`suffix-${index}`"
      tag="span"
      :content="suffix"
    )
    .dito-info(
      v-if="info"
      :data-info="info"
    )
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import { isObject, asArray } from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('DitoLabel', {
  emits: ['open'],

  props: {
    label: { type: [String, Object], default: null },
    dataPath: { type: String, default: null },
    collapsed: { type: Boolean, default: false },
    collapsible: { type: Boolean, default: false },
    info: { type: String, default: null }
  },

  computed: {
    tag() {
      return this.collapsible ? 'a' : 'div'
    },

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
  margin: 0 $form-spacing-half $form-spacing-half 0;

  &:has(.dito-schema-header) {
    // The container's label is used as teleport for a nested section or object
    // label. Hide `&__inner`, as it is be duplicated inside the nested label.
    > #{$self}__inner {
      display: none;
    }

    > #{$self} {
      // Clear bottom margin when nested.
      margin-bottom: 0;
    }
  }

  .dito-container:not(.dito-container--label-vertical) > & {
    // When labels are not vertical (e.g. compact layout, next to component),
    // clear bottom padding for better vertical alignment.
    margin-bottom: 0;
  }

  &__inner {
    display: flex;
    // Stretch to full available width so that buttons appear right-aligned:
    flex: 1 0 0%;
    overflow: hidden;
  }

  label {
    cursor: inherit;
    font-weight: bold;
    white-space: nowrap;
  }

  label,
  &__prefix,
  &__suffix {
    @include user-select(none);
    @include ellipsis;
  }

  &__prefix + label,
  label + &__suffix {
    &::before {
      content: '\a0'; // &nbsp;
    }
  }

  .dito-buttons {
    // Move the label padding inside .dito-buttons, so that it captures all
    // near mouse events:
    margin: calc(-1 * var(--label-padding));
    margin-left: 0;
    padding: var(--label-padding);
  }

  &.dito-width-fill {
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
}

a.dito-label {
  &:hover {
    .dito-chevron {
      color: $color-darker;
    }
  }

  &:focus:not(:active, .dito-active) {
    .dito-chevron {
      -webkit-text-stroke: $border-width $color-active;
    }
    // Display labels in compact schema as inline-blocks, to allow compact
    // layouts with `width: 'auto'` elements:
    // TODO: Find a better way to control this behavior.
  }
}

.dito-schema-compact {
  > .dito-schema-content {
    > .dito-pane {
      > .dito-container:not(.dito-container--label-vertical) {
        display: flex;
        flex-flow: row wrap;
        align-items: center;
      }
    }
  }
}
</style>
