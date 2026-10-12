<template lang="pug">
//- Use a <div> for nested forms, as we shouldn't nest actual <form> tags.
div(
  v-if="nested"
)
  slot
form.dito-scroll-parent(
  v-else
  :aria-label="label"
  @submit.prevent
)
  slot
</template>

<script>
export default {
  props: {
    nested: {
      type: Boolean,
      default: false
    },
    label: {
      type: String,
      default: null
    }
  }
}
</script>
