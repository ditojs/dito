<template lang="pug">
i.dito-icon(
  :class=`{
    ['dito-icon--' + name]: true,
    'dito-icon--disabled': disabled
  }`
)
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
  @at-root .dito-input & {
    position: absolute;
    inset: $border-width;
    left: unset;
    width: 2em;
    font-style: normal;
    border-radius: $border-radius;
    color: $color-grey;
    background: $color-white;

    &--disabled {
      color: $color-light;
    }
  }

  @at-root .dito-input:focus-within & {
    color: $color-active;
  }
}
</style>
