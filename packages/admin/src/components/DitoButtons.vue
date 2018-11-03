<template lang="pug">
  .dito-buttons(
    slot="buttons"
  )
    dito-button(
      v-for="button in buttons"
      v-if="shouldRender(button)"
      :schema="button"
      :dataPath="appendDataPath(dataPath, button.name)"
      :data="data"
      :meta="meta"
      :store="store"
      :params="params"
      :disabled="disabled"
    )
</template>

<script>
import DitoComponent from '@/DitoComponent'

// @vue/component
export default DitoComponent.component('dito-buttons', {
  props: {
    buttons: { type: [Object, Array], default: null },
    dataPath: { type: String, default: '' },
    data: { type: Object, required: true },
    meta: { type: Object, default: () => ({}) },
    store: { type: Object, default: () => ({}) },
    params: { type: Object, default: null },
    disabled: { type: Boolean, default: false }
  }
})
</script>
