<template lang="pug">
  .dito-form-chooser(
    :class="{ 'dito-open': open }"
  )
    button.dito-button(
      type="button"
      :class="`dito-button-${verb}`"
      @click="open = !open"
    )
    ul
      li(
        v-for="(form, type) in forms"
      )
        router-link(
          :to="{ path: `${path}create`, query: { type } }" append
        ) {{ getLabel(form) }}
</template>

<style lang="sass">
$radius: 1em
.dito
  .dito-form-chooser
    display: inline-block
    position: relative
    &:hover ul,
    &.dito-open ul
      display: block
    ul
      display: none
      position: absolute
      top: 0
      right: 0
      z-index: 2
      line-height: $line-height
      li
        a
          display: block
          text-align: center
          padding: 0.5em 1em
          background: $button-color
          &:hover
            background: $color-active
            color: $color-white
        &:first-child a
          border-top-left-radius: $radius
          border-top-right-radius: $radius
        &:last-child a
          border-bottom-left-radius: $radius
          border-bottom-right-radius: $radius
</style>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-form-chooser', {
  props: {
    forms: { type: Object, required: true },
    path: { type: String, required: true },
    verb: { type: String, required: true }
  },

  data() {
    return {
      open: false
    }
  }
})
</script>
