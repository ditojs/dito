<template lang="pug">
  VueMultiselect.dito-multiselect(
    v-model="data[name]",
    :show-labels="false",
    :placeholder="desc.placeholder",
    :options="options",
    :searchable="desc.searchable",
    :multiple="desc.multiple",
    :internal-search="true",
    :close-on-select="true",
    :loading="loading"
  )
</template>

<style src="vue-multiselect/dist/vue-multiselect.min.css"></style>
<style lang="sass">
  .dito-multiselect
    width: unset

    .multiselect__option--selected
      background: Highlight
      color: HighlightText
      font-weight: normal

    .multiselect__tags,
    .multiselect__content
      border: $border-style
      border-radius: $border-radius

    &.multiselect--above .multiselect__content
      border-bottom: none
      border-bottom-left-radius: 0
      border-bottom-right-radius: 0

    .multiselect__tag,
    .multiselect__option--highlight
      background: ActiveBorder
      color: MenuText

    .multiselect__tag-icon
      background: none
      &::after
        color: MenuText
      &:hover::after
        color: ActiveCaption
</style>

<script>
import DitoComponent from '@/DitoComponent'
import VueMultiselect from 'vue-multiselect'

export default DitoComponent.register('multiselect', {
  components: { VueMultiselect },
  data() {
    return {
      value: '',
      options: [],
      loading: false
    }
  },
  created () {
    const desc = this.desc
    if (desc.ajax) {
      this.loading = true
      this.$http.get(desc.optionsUrl
      ).then(response => {
        this.loading = false
        const options = []
        for (let option of response.data) {
          options.push(option.name)
        }
        this.options = options
      }, response => {
        console.log(response)
      })
    } else {
      this.options = desc.options
    }
  }
})
</script>
