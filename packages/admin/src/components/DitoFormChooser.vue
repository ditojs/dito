<template lang="pug">
  .dito-form-chooser
    button.dito-button(
      type="button"
      @mousedown.stop="onPulldownSelect()"
      :class="`dito-button-${verb}`"
      :title="labelize(verb)"
    )
    ul.dito-pulldown(
      v-if="schema.forms"
      :class="{ 'dito-open': pulldown.open }"
    )
      li(v-for="(form, type) in schema.forms")
        a(
          :class="`dito-${type}`"
          @mousedown.stop="handlePulldownSelect(type)"
          @mouseup="handlePulldownSelect(type, true)"
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

// @vue/component
export default DitoComponent.component('dito-form-chooser', {
  mixins: [PulldownMixin],

  props: {
    schema: { type: Object, default: null },
    path: { type: String, required: true },
    verb: { type: String, required: true }
  },

  methods: {
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
