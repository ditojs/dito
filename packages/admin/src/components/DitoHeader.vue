<template lang="pug">
nav.dito-header(:aria-busy="isLoading")
  slot(name="prepend")
  DitoTrail
    DitoSpinner(
      v-if="isLoading && spinner !== null"
      :size="spinner?.size"
      :color="spinner?.color"
    )
  //- Teleport target for `.dito-schema-header`:
  .dito-header__teleport
  slot
</template>

<script>
export default {
  props: {
    // `null` disables the spinner:
    spinner: { type: Object, default: undefined },
    isLoading: { type: Boolean, default: false }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-header {
  position: relative;
  display: flex;
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

  // The buttons that toggle the menu and the sidebar:
  &__toggle {
    position: relative;
    flex: 0 0 auto;
    width: $header-height;
    padding: 0;
    border: 0;
    color: $color-white;
    background: none;

    &::before {
      @extend %icon-sidebar;
    }

    &:hover {
      color: $color-light;
    }

    &:focus-visible {
      @include focus-ring;
    }

    // The button's own spacing separates it from the first breadcrumb:
    + .dito-trail li:first-child span {
      padding-left: 0;
    }
  }

  &__teleport {
    // Next to the trail, which scrolls when there isn't enough room for both:
    display: flex;
    flex: 0 0 auto;
    justify-content: flex-end;
    padding: 0 $header-padding-hor;

    // ...as do tabs, the only content that shrinks:
    &:has(.dito-tabs) {
      flex-shrink: 1;
      min-width: 0;
    }

    .dito-button {
      margin: 0 0 $tab-margin $tab-margin;
    }
  }
}
</style>
