<template lang="pug">
  .dito-select
    select(:id="name", v-model="data[name]")
      option(v-for="option in desc.options", :value="option.value || option")
        | {{ option.text || option }}
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.register('select')
</script>
