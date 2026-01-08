<template lang="pug">
i.dito-icon(:class="classes")
</template>

<script>
export default {
  props: {
    name: {
      type: String,
      required: true
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },

  computed: {
    classes() {
      const prefix = 'dito-icon'
      return {
        [`${prefix}--${this.name}`]: true,
        [`${prefix}--disabled`]: this.disabled
      }
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

// `yarn build:icons` converts the icon SVG files to silent classes inside
// `src/styles/mixins/_icons.scss`, making them available to all other sass
// code through `_imports`.
// In order to be able to use them as normal CSS classes, convert them here:
@each $name in $icons {
  .dito-icon--#{$name} {
    &::after {
      @extend %icon-#{$name};

      position: absolute;
    }
  }
}

.dito-icon {
  position: relative;
  width: 1em;
  height: 1em;

  @at-root .dito-input & {
    font-style: normal;
    border-radius: $border-radius;
    color: $color-grey;
    background: $color-white;

    &.dito-icon--disabled {
      color: $color-light;
    }
  }

  @at-root .dito-input:focus-within & {
    color: $color-active;
  }
}
</style>
