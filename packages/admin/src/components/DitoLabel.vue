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
  .dito-label__inner
    DitoElement.dito-label-prefix(
      v-for="(prefix, index) of prefixes"
      :key="`prefix-${index}`"
      tag="span"
      :content="prefix"
    )
    label(
      :for="dataPath"
      v-html="text"
    )
    DitoElement.dito-label-suffix(
      v-for="(suffix, index) of suffixes"
      :key="`suffix-${index}`"
      tag="span"
      :content="suffix"
    )
    .dito-info(
      v-if="info"
      :data-tippy-content="info"
    )
  slot(name="edit-buttons")
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import { isObject, asArray } from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('DitoLabel', {
  emits: ['expand'],

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
      this.$emit('expand', this.collapsed)
    }
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-label {
  $self: &;

  --label-padding: 0;
  // For buttons and chevron to align right:
  display: flex;
  position: relative;
  // Vertically center all items in the label, e.g. chevron, edit-buttons.
  align-items: center;
  padding: var(--label-padding);
  margin: 0 0 $form-spacing-half 0;

  &__inner {
    display: flex;
    // Stretch to full available width so that buttons appear right-aligned:
    flex: 1 1 auto;
  }

  label {
    cursor: inherit;
    font-weight: bold;
    white-space: nowrap;
  }

  label,
  .dito-label-prefix,
  .dito-label-suffix {
    @include user-select(none);
    @include ellipsis;
  }

  .dito-label-prefix + label,
  label + .dito-label-suffix {
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
    // we need to position it absolutely inside its container.
    #{$self}__inner {
      position: absolute;
      inset: 0;
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
      > .dito-container {
        display: flex;
        flex-flow: row wrap;
        align-items: baseline;
      }
    }
  }
}
</style>
