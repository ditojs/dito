<template lang="pug">
//- Attributes of the component around it, e.g. its `schema`, don't reach
//- the form, only its class and style:
DitoSchema(
  :class="$attrs.class"
  :style="$attrs.style"
  :schema="form.dataContext.schema"
  :data="form.dataContext.data"
  generateLabels
  @keydown.enter="onEnter"
)
  //- The layout of the component's fields:
  template(
    v-if="$slots.default"
    #default
  )
    slot
  template(#buttons)
    //- The buttons submit the form, not the `<form>` of dialogs around it:
    DitoButtons.dito-buttons--round.dito-buttons--large.dito-buttons--main(
      :buttons="form.buttonSchemas.value"
      :data="form.dataContext.data"
      @click="preventSubmit"
    )
</template>

<script>
import { inject } from 'vue'
import { schemaFormKey } from '../utils/keys.ts'

// Render the form of `useDitoForm()` in the component that set it up, with its
// fields, or with the layout of its default slot, and its buttons:
export default {
  inheritAttrs: false,

  setup() {
    const form = inject(schemaFormKey, null)
    if (!form) {
      throw new Error(
        'Unable to render `DitoSchemaForm` without `useDitoForm()`.'
      )
    }
    return {
      form,

      // Forms that aren't modal don't submit on Enter in inputs, and neither
      // do the `<form>` elements of dialogs around them:
      onEnter(event) {
        if (event.target instanceof HTMLInputElement) {
          event.preventDefault()
          event.stopPropagation()
        }
      },

      preventSubmit(event) {
        if (event.target.closest('[type="submit"]')) {
          event.preventDefault()
        }
      }
    }
  }
}
</script>
