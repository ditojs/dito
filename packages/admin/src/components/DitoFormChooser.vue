<template lang="pug">
  .dito-form-chooser(
    :class="{ 'dito-open': open }"
  )
    button.dito-button(
      type="button"
      :class="`dito-button-${verb}`"
      @click="onCreate()"
    )
    ul(v-if="schema.forms")
      li(v-for="(form, type) in schema.forms")
        a(@click="onCreate(type)") {{ getLabel(form) }}
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-form-chooser', {
  props: {
    schema: { type: Object },
    path: { type: String, required: true },
    verb: { type: String, required: true }
  },

  data() {
    return {
      open: false
    }
  },

  methods: {
    onCreate(type) {
      const { schema } = this
      const { forms, inline } = schema
      const form = type
        ? forms && forms[type]
        : schema.form
      if (form) {
        if (inline) {
          this.$parent.createItem(form, type)
        } else {
          this.$router.push({
            path: `${this.path}create`,
            query: { type },
            append: true
          })
        }
        this.open = false
      } else if (forms) {
        this.open = !this.open
      }
    }
  }
})
</script>

<style lang="sass">
$radius: 0.5em
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
      border-radius: $radius
      box-shadow: 0 2px 6px 0 rgba($color-shadow, 0.25)
      li
        a
          display: block
          text-align: center
          padding: 0.5em 1em
          height: 1em
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

