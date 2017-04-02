<template lang="pug">
  li
    dito-label(v-if="label", :text="label")
      slot
    slot(v-else)
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.register('form-field', {
  props: ['label']
})
</script>
