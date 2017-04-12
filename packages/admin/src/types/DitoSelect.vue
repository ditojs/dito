<template lang="pug">
  select(:id="name", v-model="value")
    option(v-for="option in desc.options", :value="option.value")
      | {{ option.text }}
</template>


<script>
import TypeComponent from '@/TypeComponent'

export default TypeComponent.register('select')
</script>
