<template lang="pug">
  textarea.dito-textarea.dito-input(
    ref="element"
    :id="dataPath"
    v-model="value"
    v-bind="attributes"
    v-on="listeners"
    :rows="lines"
  )
</template>

<script>
import TypeComponent from '@/TypeComponent'

// @vue/component
export default TypeComponent.register('textarea', {
  nativeField: true,
  textField: true,

  computed: {
    lines() {
      return this.schema.lines || 4
    }
  }
})
</script>
