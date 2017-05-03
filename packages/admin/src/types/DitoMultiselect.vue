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
    .multiselect__tag,
    .multiselect__option--highlight
      background: #444
    .multiselect__tag-icon
      &::after
        color: #fff
      &:hover
        background: #f00
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
