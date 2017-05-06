<template lang="pug">
  .dito-select
    select(:id="name", v-model="data[name]")
      template(v-for="option in options")
        optgroup(v-if="desc.options.groupBy", :label="option[groupLabelKey]")
          option(v-for="opt in option[groupOptionsKey]", :value="getValue(opt)")
            | {{ getLabel(opt) }}
        option(v-else, :value="getValue(option)")
          | {{ getLabel(option) }}
</template>

<script>
import DitoComponent from '@/DitoComponent'
import OptionsMixin from '@/mixins/OptionsMixin'

export default DitoComponent.register('select', {
  mixins: [OptionsMixin]
})
</script>
