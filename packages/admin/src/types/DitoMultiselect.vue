<template lang="pug">
  multiselect.dito-multiselect(
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
    .multiselect__option--highlight
      background-color: rgb(70,70,70)
    .multiselect__tag-icon:after
      color: #FFF
    .multiselect__tag
      background-color: rgb(70,70,70)
    .multiselect__tag-icon:hover
      background-color: #f00
</style>

<script>
import DitoComponent from '@/DitoComponent'
import Multiselect from 'vue-multiselect'
import axios from 'axios'

export default DitoComponent.register('multiselect', {
  components: { Multiselect },
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
      axios.get(desc.optionsUrl)
        .then(response => {
          this.loading = false
          let options = []
          for (let option of response.data) {
            options.push(option.name)
          }
          this.options = options
        })
        .catch(error => {
          console.log(error)
        })
    } else {
      this.options = desc.options
    }
  }
})
</script>
