<template lang="pug">
  nav.dito-header
    .dito-trail
      ul
        li(
          v-for="(component, index) in trail"
        )
          template(v-if="index === trail.length - 1")
            span(:class="getBreadcrumbClass(component)")
              | {{ component.breadcrumb }}
          router-link.dito-breadcrumb(v-else, :to="component.path")
            span(:class="getBreadcrumbClass(component)")
              | {{ component.breadcrumb }}
      spinner.dito-spinner(v-if="isLoading")
    slot
</template>

<style lang="sass">
  .dito-header
    background: $color-black
    font-size: $menu-font-size
    line-height: $menu-line-height
    z-index: $menu-z-index
    +user-select(none)
    span
      display: inline-block
      padding: $menu-padding
      color: $color-white
    .dito-trail
      display: flex
      box-sizing: border-box
      height: 3em
      width: 100%
      max-width: $content-width + $content-padding
      ul
        display: flex
      a
        position: relative
        display: block
        padding-right: 0.4em
        $angle: 33deg
        &:hover
          color: #999
        &::before,
        &::after
          position: absolute
          content: ''
          width: 1px
          height: 1.2em
          right: -1px
          background: $color-dark
        &::before
          top: 50%
          transform: rotate($angle)
          transform-origin: top
        &::after
          bottom: 50%
          transform: rotate(-$angle)
          transform-origin: bottom
    .dito-spinner
      margin-top: $menu-padding-ver
    .dito-dirty
      &:after
        content: ''
        display: inline-block
        background-color: $color-white
        width: 8px
        height: 8px
        margin: 2px
        margin-left: 0.5em
        border-radius: 100%
    .dito-account,
    .dito-login
      position: absolute
      top: 0
      cursor: pointer
    .dito-account
      left: $content-width + $content-padding * 2
</style>

<script>
import DitoComponent from '../DitoComponent.js'
import PulseLoader from 'vue-spinner/src/PulseLoader.vue'

const Spinner = DitoComponent.component('spinner', PulseLoader)

// @vue/component
export default DitoComponent.component('dito-header', {
  components: { Spinner },

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
    const { props } = Spinner.options
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
