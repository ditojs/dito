<template lang="pug">
  .dito-form-chooser
    button.dito-button(
      type="button"
      @mousedown="handlePulldownClick($event)"
      :class="`dito-button-${verb}`"
      :title="labelize(verb)"
    )
    ul.dito-pulldown(
      v-if="schema.forms"
      :class="{ 'dito-open': pulldown.open }"
    )
      li(v-for="(form, type) in schema.forms")
        a(
          @mousedown="handlePulldownSelect(type)"
          @mouseup="handlePulldownSelect(type)"
        ) {{ getLabel(form) }}
</template>

<style lang="sass">
.dito
  .dito-form-chooser
    position: relative
    .dito-pulldown
      right: 0
</style>

<script>
import DitoComponent from '@/DitoComponent'
import PulldownMixin from '@/mixins/PulldownMixin'

export default DitoComponent.component('dito-form-chooser', {
  mixins: [PulldownMixin],

  props: {
    schema: { type: Object },
    path: { type: String, required: true },
    verb: { type: String, required: true }
  },

  methods: {
    handlePulldownClick(event) {
      this.onPulldownSelect()
      event.stopPropagation()
    },

    onPulldownSelect(type) {
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
        this.showPulldown(false)
      } else if (forms) {
        this.showPulldown(true)
      }
    }
  }
})
</script>
