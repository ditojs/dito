<template lang="pug">
.dito-create-button
  template(
    v-if="showPulldown"
  )
    button.dito-button(
      type="button"
      :class="`dito-button-${verb}`"
      :title="labelize(verb)"
      @mousedown.stop="onPulldownMouseDown()"
    ) {{ text }}
    ul.dito-pulldown(:class="{ 'dito-open': pulldown.open }")
      li(
        v-for="(form, type) in forms"
      )
        a(
          v-if="shouldRender(form)"
          v-show="shouldShow(form)"
          :class="getFormClass(form, type)"
          @mousedown.stop="onPulldownMouseDown(type)"
          @mouseup="onPulldownMouseUp(type)"
        ) {{ getLabel(form) }}
  button.dito-button(
    v-else
    :type="isInlined ? 'button' : 'submit'"
    :class="`dito-button-${verb}`"
    :title="labelize(verb)"
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
      return Object.keys(this.forms).length > 1 || !this.forms.default
    }
  },

  methods: {
    createItem(form, type = null) {
      if (this.shouldRender(form) && !this.shouldDisable(form)) {
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
        'dito-disabled': this.shouldDisable(form)
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
