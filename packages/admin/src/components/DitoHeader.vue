<template lang="pug">
nav.dito-header
  DitoTrail
    DitoSpinner(
      v-if="isLoading"
      :size="spinner?.size"
      :color="spinner?.color"
    )
  //- Teleport target for `.dito-schema-header`:
  .dito-header__teleport
  slot
</template>

<script>
import DitoComponent from '../DitoComponent.js'

// @vue/component
export default DitoComponent.component('DitoHeader', {
  props: {
    spinner: {
      type: Object,
      default: null
    },
    isLoading: {
      type: Boolean,
      default: false
    }
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-header {
  position: relative;
  background: $color-black;
  font-size: $header-font-size;
  line-height: $header-line-height;
  z-index: $z-index-header;
  @include user-select(none);

  &::after {
    // Set the full-width header background to the header color.
    content: '';
    inset: 0;
    width: 100vw;
    position: absolute;
    background: inherit;
    z-index: -1;
  }

  span {
    display: inline-block;
    padding: $header-padding;
    color: $color-white;

    &:empty {
      &::after {
        content: '\200b';
      }
    }
  }

  &__teleport {
    // Align the teleported schema headers on top of to the header menu.
    position: absolute;
    inset: 0;
    display: flex;
    justify-content: flex-end;
    padding: 0 $header-padding-hor;
    // Turn off pointer events so that DitoTrail keeps receiving events...
    pointer-events: none;
    // ...but move them to the children.
    > * {
      pointer-events: auto;
    }

    .dito-button {
      margin: 0 0 $tab-margin $tab-margin;
    }
  }
}
</style>
