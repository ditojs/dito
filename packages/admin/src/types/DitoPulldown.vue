<template lang="pug">
  select(:id="name", v-model="data[name]")
    option(v-for="option in desc.options", :value="option.value || option")
      | {{ option.text || option }}
</template>

<script>
import TypeComponent from '@/TypeComponent'

export default TypeComponent.register('pulldown')
</script>
