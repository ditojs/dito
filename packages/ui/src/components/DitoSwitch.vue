<template lang="pug">
.dito-switch(
  :class="$attrs.class"
  :style="styles"
)
  SwitchRoot.dito-switch__control(
    ref="control"
    v-slot="{ checked }"
    v-bind="attributes"
  )
    SwitchThumb.dito-switch__thumb
    span.dito-switch__label(
      v-if="labels"
    )
      slot(
        v-if="checked"
        name="checked"
      ) {{ labels.checked || 'on' }}
      slot(
        v-else
        name="unchecked"
      ) {{ labels.unchecked || 'off' }}
</template>

<script>
import { SwitchRoot, SwitchThumb } from 'reka-ui'

// The class goes to the root, all other attributes to reka-ui's `SwitchRoot`,
// also `v-model`, `id`, `name` and `disabled`.
export default {
  components: { SwitchRoot, SwitchThumb },
  inheritAttrs: false,

  props: {
    labels: { type: [Object, Boolean], default: false }
  },

  computed: {
    styles() {
      const { labels: { checked, unchecked } = {} } = this
      // Calculate `--switch-width` in `rem`, based on the given labels' length.
      const length = Math.max(checked?.length ?? 0, unchecked?.length ?? 0)
      return {
        '--switch-width': length ? `${length * 1.5}rem` : null
      }
    },

    attributes() {
      const { class: _, ...attributes } = this.$attrs
      return attributes
    }
  },

  methods: {
    focus() {
      this.$refs.control.$el.focus()
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-switch {
  $self: &;

  // Use whole multiples of `rem` for sizes and `px` margins/padding along
  // with `calc()` to end up with even pixel sizes.
  --switch-width: 4em;
  --switch-height: 2em;
  --switch-margin: 2px;
  --switch-padding: 3px;
  --switch-speed: 300ms;
  --label-margin: 0.5em;
  --width: calc(var(--switch-width) - 2 * var(--switch-margin));
  --height: calc(var(--switch-height) - 2 * var(--switch-margin));
  --offset: calc(var(--width) - var(--height));

  display: inline-flex;
  align-items: center;
  height: var(--switch-height);
  // To make inline labels appear on consistent baseline:
  vertical-align: bottom;
  @include user-select(none);

  &__control {
    position: relative;
    box-sizing: border-box;
    width: var(--width);
    height: var(--height);
    padding: 0;
    border: 0;
    border-radius: 1em;
    background: $color-light;
    transition: background-color 0.3s;
  }

  &__thumb {
    --size: calc(var(--height) - 2 * var(--switch-padding));

    position: absolute;
    top: var(--switch-padding);
    left: var(--switch-padding);
    width: var(--size);
    height: var(--size);
    border-radius: calc(var(--size) / 2);
    box-sizing: border-box;
    background: $color-white;
    transition: transform var(--switch-speed);
    transform: translateX(0);
  }

  &__label {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    right: var(--label-margin);
    text-transform: uppercase;
    color: $color-white;
  }

  &__control[data-state='checked'] {
    background: $color-active;

    #{$self}__thumb {
      transform: translateX(var(--offset));
    }

    #{$self}__label {
      left: var(--label-margin);
      right: unset;
    }
  }

  &__control[data-disabled] {
    @extend %button--disabled;
  }

  &__control:focus-visible {
    #{$self}__thumb {
      @include focus-ring;
    }
  }
}
</style>
