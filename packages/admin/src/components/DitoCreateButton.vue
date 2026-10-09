<template lang="pug">
.dito-create-button
  DitoButton(
    v-if="creatableForm"
    :type="isInlined ? 'button' : 'submit'"
    :verb="verb"
    :subject="formLabel"
    :text="text"
    :disabled="disabled"
    @click="createItem(creatableForm)"
  )
  DitoMenuButton(
    v-else-if="hasCreatableForms"
    :items="menuItems"
    placement="bottom-right"
    :disabled="disabled"
    :verb="verb"
    :text="text"
    @select="onSelectMenuItem"
  )
</template>

<script>
import { DitoButton, DitoMenuButton } from '@ditojs/ui/src'
import DitoComponent from '../DitoComponent.js'
import ContextMixin from '../mixins/ContextMixin.js'
import { isInlined } from '../utils/schema/structure.js'
import { getCreatableForms } from '../utils/schema/data.js'

// @vue/component
export default DitoComponent.component('DitoCreateButton', {
  mixins: [ContextMixin],
  components: { DitoButton, DitoMenuButton },

  props: {
    // The schema of the list or object source that creates the item, also
    // when inserting at `insertIndex` from the buttons of an item.
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
    nested: { type: Boolean, default: false },
    path: { type: String, required: true },
    verb: { type: String, required: true },
    text: { type: String, default: null },
    disabled: { type: Boolean, required: true },
    insertIndex: { type: Number, default: null }
  },

  computed: {
    creatableForms() {
      return getCreatableForms(this.schema, this.context)
    },

    hasCreatableForms() {
      return Object.keys(this.creatableForms).length > 0
    },

    creatableForm() {
      const forms = this.creatableForms
      return (Object.keys(forms).length === 1 && forms.default) || null
    },

    menuItems() {
      return Object.entries(this.creatableForms)
        .filter(([, form]) => this.shouldShowSchema(form))
        .map(([type, form]) => ({
          value: type,
          label: this.getLabel(form),
          disabled: this.shouldDisableSchema(form)
        }))
    },

    formLabel() {
      // Only use labels declared on the form, not ones derived from its name.
      const form = this.creatableForm
      return form
        ? this.getSchemaValue('label', { schema: form, type: String })
        : null
    },

    isInlined() {
      return isInlined(this.schema)
    }
  },

  methods: {
    createItem(form, type = null) {
      if (!this.shouldDisableSchema(form)) {
        if (this.isInlined) {
          this.sourceComponent.createItem(form, type, this.insertIndex)
        } else {
          const { creatable } = this.schema
          const query = {
            ...(type && { type }),
            ...creatable?.query?.(this.context)
          }
          this.$router.push({
            path: `${this.path}/create`,
            query
          })
        }
      } else {
        throw new Error('Not allowed to create item for given form')
      }
    },

    onSelectMenuItem({ value: type }) {
      this.createItem(this.creatableForms[type], type)
    }
  }
})
</script>
