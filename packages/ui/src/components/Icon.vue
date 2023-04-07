<template lang="pug">
i.dito-icon(:class="`dito-icon-${name}`")
</template>

<script>
export default {
  props: {
    name: {
      type: String,
      required: true
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
  .dito-icon-#{$name} {
    @extend %icon-#{$name};
  }
}
</style>
