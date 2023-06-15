<template lang="pug">
.dito-create-button
  button.dito-button(
    v-if="creatableForm"
    :type="isInlined ? 'button' : 'submit'"
    :disabled="disabled"
    v-bind="getButtonAttributes(verb)"
    @click="createItem(creatableForm)"
  ) {{ text }}
  template(
    v-else-if="creatableForms"
  )
    button.dito-button(
      type="button"
      :disabled="disabled"
      v-bind="getButtonAttributes(verb)"
      @mousedown.stop="onPulldownMouseDown()"
    ) {{ text }}
    ul.dito-pulldown(:class="{ 'dito-open': pulldown.open }")
      li(
        v-for="(form, type) in creatableForms"
      )
        a(
          v-show="shouldShowSchema(form)"
          :class="getFormClass(form, type)"
          @mousedown.stop="onPulldownMouseDown(type)"
          @mouseup="onPulldownMouseUp(type)"
        ) {{ getLabel(form) }}
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
    // The next four props are there for `DitoContext` and the `context()`
    // getter in `DitoMixin`.
    // TODO: Should they be moved to shared mixin that defines them as required
    // and also provides the `context()` getter, perhaps `ContextMixin`?
    // `schema` could be included as well, and `ContextMixin` could be used in
    // `DitoForm`, `DitoView`, `DitoPanel`, `DitoSchema`, `DitoEditButtons`,
    // etc? But the problem with the root components is that they don't have
    // these props. We could add a `contextAttributes()` getter for easy passing
    // on as `v-bind="contextAttributes"`.
    dataPath: { type: String, required: true },
    data: { type: [Object, Array], default: null },
    meta: { type: Object, required: true },
    store: { type: Object, required: true },
    path: { type: String, required: true },
    verb: { type: String, required: true },
    text: { type: String, default: null },
    disabled: { type: Boolean, required: true }
  },

  computed: {
    forms() {
      return getFormSchemas(this.schema, this.context)
    },

    creatableForms() {
      const entries = Object.entries(this.forms).filter(
        (type, form) => this.isFormCreatable(form)
      )
      return entries.length > 0
        ? Object.fromEntries(entries)
        : null
    },

    creatableForm() {
      const forms = this.creatableForms
      return forms && Object.keys(forms).length === 1 && forms.default || null
    },

    isInlined() {
      return isInlined(this.schema)
    }
  },

  methods: {
    isFormCreatable(form) {
      // Forms can be excluded from the list by providing `if: false` or
      // `creatable: false`.
      return (
        this.shouldRenderSchema(form) &&
        this.getSchemaValue('creatable', {
          type: Boolean,
          default: true,
          schema: form
        })
      )
    },

    createItem(form, type = null) {
      if (!this.shouldDisableSchema(form)) {
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

    .dito-buttons-sticky & {
      top: unset;
      right: unset;
      bottom: 0;
      left: 0;
    }
  }
}
</style>
