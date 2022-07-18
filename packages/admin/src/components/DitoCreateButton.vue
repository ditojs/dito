<template lang="pug">
  .dito-create-button
    template(v-if="showPulldown")
      button.dito-button(
        type="button"
        @mousedown.stop="onPulldownMouseDown()"
        :class="`dito-button-${verb}`"
        :title="labelize(verb)"
      ) {{ text }}
      ul.dito-pulldown(
        :class="{ 'dito-open': pulldown.open }"
      )
        li(v-for="(form, type) in forms")
          a(
            v-if="isCreatable(form)"
            :class="`dito-type-${type}`"
            @mousedown.stop="onPulldownMouseDown(type)"
            @mouseup="onPulldownMouseUp(type)"
          ) {{ getLabel(form) }}
    button.dito-button(
      v-else
      :type="isInlined ? 'button' : 'submit'"
      @click="createItem(forms.default)"
      :class="`dito-button-${verb}`"
      :title="labelize(verb)"
    ) {{ text }}
</template>

<style lang="sass">
  .dito-create-button
    position: relative
    .dito-pulldown
      right: 0
</style>

<script>
import DitoComponent from '../DitoComponent.js'
import PulldownMixin from '../mixins/PulldownMixin.js'
import { getFormSchemas, isInlined } from '../utils/schema.js'

// @vue/component
export default DitoComponent.component('dito-create-button', {
  mixins: [PulldownMixin],

  props: {
    schema: { type: Object, required: true },
    path: { type: String, required: true },
    verb: { type: String, required: true },
    text: { type: String, default: null }
  },

  computed: {
    forms() {
      return getFormSchemas(this.schema, this.context)
    },

    isInlined() {
      return isInlined(this.schema)
    },

    showPulldown() {
      return Object.keys(this.forms).length > 1 || !this.forms.default
    }
  },

  methods: {
    isCreatable(form) {
      // Forms can be excluded from the list by providing `creatable: false`
      return form.creatable !== false
    },

    createItem(form, type = null) {
      if (this.isCreatable(form)) {
        if (this.isInlined) {
          this.sourceComponent.createItem(form, type)
        } else {
          this.$router.push({
            path: `${this.path}/create`,
            query: { type },
            append: true
          })
        }
      } else {
        throw new Error('Not allowed to create item for given form')
      }
    },

    onPulldownSelect(type) {
      this.createItem(this.forms[type], type)
      this.setPulldownOpen(false)
    }
  }
})
</script>
