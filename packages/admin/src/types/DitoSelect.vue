<template lang="pug">
  // In order to make an arrow appear over the select item, we need nesting:
  .dito-select
    select(
      :id="name",
      :name="name",
      v-model="data[name]",
      v-validate="validations"
    )
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
