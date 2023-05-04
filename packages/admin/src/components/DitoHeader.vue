<template lang="pug">
nav.dito-header
  .dito-trail
    ul
      li(
        v-for="(component, index) in trail"
      )
        template(
          v-if="index === trail.length - 1"
        )
          span(:class="getBreadcrumbClass(component)")
            | {{ component.breadcrumb }}
        RouterLink.dito-breadcrumb(
          v-else
          :to="component.path"
        )
          span(:class="getBreadcrumbClass(component)")
            | {{ component.breadcrumb }}
    DitoSpinner(
      v-if="isLoading"
    )
  //- Teleport target for `.dito-schema-header`:
  .dito-title
  slot
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import DitoSpinner from './DitoSpinner.vue'

// @vue/component
export default DitoComponent.component('DitoHeader', {
  components: { DitoSpinner },

  props: {
    spinner: {
      type: Object,
      default: null
    },
    isLoading: {
      type: Boolean,
      default: false
    }
  },

  computed: {
    trail() {
      return this.appState.routeComponents.filter(
        component => !!component.routeRecord
      )
    }
  },

  created() {
    const {
      size = '8px',
      color = '#999'
    } = this.spinner || {}
    // TODO: This is a hack to set the default props for the DitoSpinner.
    // Pass them on through the template instead!
    const { props } = DitoSpinner
    props.size.default = size
    props.color.default = color
  },

  methods: {
    getBreadcrumbClass(component) {
      return {
        'dito-dirty': component.isDirty
      }
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
  z-index: $header-z-index;
  @include user-select(none);

  &::after {
    // Cover the gaps between the different headers that might appear due to
    // layout rounding imprecisions.
    content: '';
    top: 0;
    bottom: 0;
    left: calc(100% - 1px);
    width: 2px;
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

  .dito-trail {
    display: flex;
    box-sizing: border-box;
    height: 3em;

    ul {
      display: flex;
    }

    li {
      white-space: nowrap;
    }

    a {
      position: relative;
      display: block;

      $angle: 33deg;

      &:hover {
        span {
          color: $color-light;
        }
      }

      &::before,
      &::after {
        position: absolute;
        content: '';
        width: 1px;
        height: 0.75em;
        right: -0.25em;
        background: $color-white;
        opacity: 0.5;
      }

      &::before {
        top: 50%;
        transform: rotate($angle);
        transform-origin: top;
      }

      &::after {
        bottom: 50%;
        transform: rotate(-$angle);
        transform-origin: bottom;
      }
    }
  }

  .dito-spinner {
    margin-top: $header-padding-ver;
  }

  .dito-dirty {
    &::after {
      content: '';
      display: inline-block;
      background-color: $color-white;
      width: 8px;
      height: 8px;
      margin: 2px;
      margin-left: 0.5em;
      border-radius: 100%;
    }
  }
}
</style>
