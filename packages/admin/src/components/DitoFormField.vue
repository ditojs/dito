<template lang="pug">
  li
    dito-label(v-if="label", :text="label")
      slot
    slot(v-else)
</template>

<script>
import BaseComponent from '@/BaseComponent'

export default BaseComponent.component('dito-form-field', {
  props: ['label']
})
</script>
