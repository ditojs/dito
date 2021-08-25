<template lang="pug">
  dito-label.dito-label-component(:label="value" :dataPath="dataPath")
</template>

<style lang="sass">
  .dito-label-component
    display: flex
    height: 2em
</style>

<script>
import TypeComponent from '@/TypeComponent'

// @vue/component
export default TypeComponent.register('label', {
  generateLabel: false
})
</script>
