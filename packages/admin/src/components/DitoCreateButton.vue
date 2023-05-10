<template lang="pug">
.dito-create-button
  template(
    v-if="showPulldown"
  )
    button.dito-button(
      type="button"
      v-bind="getButtonAttributes(verb)"
      @mousedown.stop="onPulldownMouseDown()"
    ) {{ text }}
    ul.dito-pulldown(:class="{ 'dito-open': pulldown.open }")
      li(
        v-for="(form, type) in forms"
      )
        a(
          v-if="isFormCreatable(form)"
          v-show="shouldShowSchema(form)"
          :class="getFormClass(form, type)"
          @mousedown.stop="onPulldownMouseDown(type)"
          @mouseup="onPulldownMouseUp(type)"
        ) {{ getLabel(form) }}
  button.dito-button(
    v-else-if="isFormCreatable(forms.default)"
    :type="isInlined ? 'button' : 'submit'"
    v-bind="getButtonAttributes(verb)"
    @click="createItem(forms.default)"
  ) {{ text }}
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import PulldownMixin from '../mixins/PulldownMixin.js'
import { getFormSchemas, isInlined } from '../utils/schema.js'

// @vue/component
export default DitoComponent.component('DitoCreateButton', {
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
      const forms = Object.values(this.forms)
      return (
        (forms.length > 1 || !this.forms.default) &&
        forms.some(this.isFormCreatable)
      )
    }
  },

  methods: {
    isFormCreatable(form) {
      // Forms can be excluded from the list by providing `if: false` or
      // `creatable: false`.
      return form.creatable !== false && this.shouldRenderSchema(form)
    },

    createItem(form, type = null) {
      if (this.isFormCreatable(form) && !this.shouldDisableSchema(form)) {
        if (this.isInlined) {
          this.sourceComponent.createItem(form, type)
        } else {
          this.$router.push({
            path: `${this.path}/create`,
            query: { type }
          })
        }
      } else {
        throw new Error('Not allowed to create item for given form')
      }
    },

    getFormClass(form, type) {
      return {
        [`dito-type-${type}`]: true,
        'dito-disabled': this.shouldDisableSchema(form)
      }
    },

    onPulldownSelect(type) {
      this.createItem(this.forms[type], type)
      this.setPulldownOpen(false)
    }
  }
})
</script>

<style lang="scss">
.dito-create-button {
  position: relative;

  .dito-pulldown {
    right: 0;
  }
}
</style>
