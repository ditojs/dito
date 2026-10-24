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

    // Follow the button's color, instead of the background and the focus
    // color of icons in inputs:
    @at-root .dito-input #{&} .dito-icon,
      .dito-input:focus-within #{&} .dito-icon {
      color: inherit;
      background: none;
    }
  }

  &--ellipsis {
    @include ellipsis;

    flex: 1;
    display: block;
    min-width: 0;
    width: 0;
  }
}
</style>
