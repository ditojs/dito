<template lang="pug">
  .dito-form-chooser(
    :class="{ 'dito-open': open }"
  )
    button.dito-button(
      type="button"
      @mousedown="onMouseDown($event)"
      :class="`dito-button-${verb}`"
      :title="labelize(verb)"
    )
    ul(v-if="schema.forms")
      li(v-for="(form, type) in schema.forms")
        a(
          @mousedown="onSelectDelayed(type)"
          @mouseup="onSelectDelayed(type)"
        ) {{ getLabel(form) }}
</template>

<script>
import DitoComponent from '@/DitoComponent'
import DomMixin from '@/mixins/DomMixin'

export default DitoComponent.component('dito-form-chooser', {
  mixins: [DomMixin],

  props: {
    schema: { type: Object },
    path: { type: String, required: true },
    verb: { type: String, required: true }
  },

  data() {
    return {
      open: false,
      startTime: 0,
      documentHandlers: {
        mousedown: () => {
          this.show(false)
          this.domOff(document, this.documentHandlers)
        },

        mouseup: () => {
          if (this.onSelectDelayed()) {
            this.domOff(document, this.documentHandlers)
          }
        }
      }
    }
  },

  methods: {
    onMouseDown(event) {
      this.onSelect()
      // Prevent document mousedown that would close the pulldown right away
      event.stopPropagation()
    },

    onSelectDelayed(type) {
      if (this.startTime && Date.now() - this.startTime > 250) {
        this.show(false)
        if (type) {
          this.onSelect(type)
        }
        return true
      }
    },

    onSelect(type) {
      const { schema } = this
      const { forms, inline } = schema
      const form = type
        ? forms?.[type]
        : schema.form
      if (form) {
        if (inline) {
          this.$parent.createItem(form, type)
        } else {
          this.$router.push({
            path: `${this.path}/create`,
            query: { type },
            append: true
          })
        }
        this.show(false)
      } else if (forms) {
        this.show(true)
      }
    },

    show(open) {
      this.open = open
      this.startTime = open ? Date.now() : 0
      if (open) {
        this.domOn(document, this.documentHandlers)
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
          cursor: pointer
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

