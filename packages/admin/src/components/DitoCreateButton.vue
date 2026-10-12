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
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { DitoButton, DitoMenuButton } from '@ditojs/ui/src'
import { useSchemaContext } from '../composables/useSchemaContext.ts'
import { useSchemaValue } from '../composables/useSchemaValue.ts'
import { isInlined } from '../utils/schema/structure.js'
import { getCreatableForms } from '../utils/schema/data.js'

export default {
  name: 'DitoCreateButton',
  components: { DitoButton, DitoMenuButton },

  props: {
    // The source that creates the item, also when inserting at `insertIndex`:
    schema: { type: Object, required: true },
    // The next four props are there for the `context` of the callbacks:
    dataPath: { type: String, required: true },
    data: { type: [Object, Array], default: null },
    store: { type: Object, required: true },
    nested: { type: Boolean, default: false },
    path: { type: String, default: null },
    verb: { type: String, required: true },
    text: { type: String, default: null },
    disabled: { type: Boolean, required: true },
    insertIndex: { type: Number, default: null }
  },

  setup(props) {
    const router = useRouter()
    const { context, services } = useSchemaContext(props)
    const { getSchemaValue, getLabel } = useSchemaValue(context)
    const creatableForms = computed(() =>
      getCreatableForms(props.schema, context)
    )
    const creatableForm = computed(() => {
      const forms = creatableForms.value
      return (Object.keys(forms).length === 1 && forms.default) || null
    })
    const isInlinedSource = computed(() => isInlined(props.schema))

    const isDisabled = form =>
      getSchemaValue('disabled', {
        schema: form,
        type: Boolean,
        default: false
      })

    const createItem = (form, type = null) => {
      if (isDisabled(form)) {
        throw new Error('Not allowed to create item for given form')
      } else if (isInlinedSource.value) {
        services.source.createItem(form, type, props.insertIndex)
      } else {
        const { creatable } = props.schema
        const query = {
          ...(type && { type }),
          ...creatable?.query?.(context)
        }
        router.push({ path: props.path, query })
      }
    }

    return {
      creatableForm,
      isInlined: isInlinedSource,
      createItem,

      hasCreatableForms: computed(
        () => Object.keys(creatableForms.value).length > 0
      ),

      menuItems: computed(() =>
        Object.entries(creatableForms.value)
          .filter(([, form]) =>
            getSchemaValue('visible', {
              schema: form,
              type: Boolean,
              default: true
            })
          )
          .map(([type, form]) => ({
            value: type,
            label: getLabel(form),
            disabled: isDisabled(form)
          }))
      ),

      // Only use labels declared on the form, not ones derived from its name.
      formLabel: computed(() => {
        const form = creatableForm.value
        return form
          ? getSchemaValue('label', { schema: form, type: String })
          : null
      }),

      onSelectMenuItem({ value: type }) {
        createItem(creatableForms.value[type], type)
      }
    }
  }
}
</script>
