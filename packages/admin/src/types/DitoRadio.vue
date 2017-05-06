<template lang="pug">
  ul.dito-radio.dito-inline(:id="name")
    li(v-for="option in desc.options")
      label
        input(
          :name="name",
          type="radio",
          v-model="data[name]",
          v-validate="validations",
          :disabled="disabled",
          :value="option"
        )
        | {{option}}
</template>

<style lang="sass">
.dito
  .dito-radio
    input
      margin-right: 0.5em
</style>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.register('radio')
</script>
