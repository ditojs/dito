<template lang="pug">
  .dito-select
    select(:id="name", v-model="data[name]")
      option(v-for="option in options", :value="getValue(option)")
        | {{ getLabel(option) }}
</template>

<script>
import DitoComponent from '@/DitoComponent'
import OptionsMixin from '@/mixins/OptionsMixin'

export default DitoComponent.register('select', {
  mixins: [OptionsMixin]
})
</script>
