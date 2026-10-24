<template lang="pug">
component(
  v-if="item.type === 'text'"
  :is="item.as || 'div'"
  v-html="getHtml(item)"
)
DitoSpinner(
  v-else-if="item.type === 'spinner'"
  :size="item.size"
  :color="item.color"
)
DitoIcon(
  v-else-if="item.type === 'icon'"
  :name="item.name"
  :disabled="item.disabled"
)
component(
  v-else-if="item.type === 'component'"
  :is="item.component"
  v-bind="item.props"
)
//- Don't let the input take the focus on mousedown:
button(
  v-else-if="item.type === 'button'"
  type="button"
  :title="item.title"
  :disabled="item.disabled"
  @click.stop="item.onClick?.(context)"
  @mousedown.stop
)
  DitoIcon(
    v-if="item.icon"
    :name="item.icon"
    :disabled="item.disabled"
  )
  template(
    v-else
  ) {{ item.text }}
</template>

<script>
import DitoSpinner from './DitoSpinner.vue'
import { DitoIcon } from '@ditojs/ui/src'
import { getHtml } from '../utils/html.js'

export default {
  components: { DitoSpinner, DitoIcon },

  props: {
    item: { type: Object, required: true },
    // For the callbacks of buttons:
    context: { type: Object, default: null }
  },

  setup() {
    return { getHtml }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-affix {
  &--text {
    display: inline-block;
  }

  &--button {
    // Reach into the padding of inputs up to 2px from their border, without
    // moving the text:
    box-sizing: border-box;
    padding: ($input-padding-ver - 2 * $border-width)
      ($input-padding-hor - 2 * $border-width);
    margin: (-$input-padding-ver + 2 * $border-width)
      (-$input-padding-hor + 2 * $border-width);
    border: 0;
    border-radius: $border-radius * 0.5;
    background: $color-lightest;
    font: inherit;
    color: inherit;
    cursor: pointer;

    &:hover:not(:disabled) {
      color: $color-text;
      background: $button-color;
    }
  }

  &--ellipsis {
    @include ellipsis;

    flex: 1;
    display: block;
    min-width: 0;
    width: 0;
  }

  // Hover affixes only show while the component is hovered, overlaying the
  // other affixes of their side and the input's padding instead of widening
  // the input:
  &--hover {
    --size: #{calc($input-height - 6 * $border-width)};

    display: none;
    position: absolute;
    right: 0;
    align-items: center;
    justify-content: center;
    min-width: var(--size);
    height: var(--size);
    padding: 0;

    // Not when hovering an open popup of the component, e.g. a color picker:
    @at-root .dito-component:not(:has(.dito-component, .dito-popup:hover)):hover
        & {
      display: flex;
    }
  }
}
</style>
