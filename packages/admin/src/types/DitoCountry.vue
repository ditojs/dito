<template lang="pug">
  multiselect.dito-country(
    v-model="value",
    placeholder="Select Country",
    :options="options",
    :searchable="true",
    :internal-search="true",
    :close-on-select="true",
    :loading="loading",
  )
</template>

<style src="vue-multiselect/dist/vue-multiselect.min.css"></style>
<style lang="sass">
  .dito-country
    width: unset
</style>

<script>
import DitoComponent from '@/DitoComponent'
import Multiselect from 'vue-multiselect'

export default DitoComponent.register('country', {
  components: { Multiselect },
  data() {
    return {
      value: '',
      options: [],
      loading: false
    }
  },
  created () {
    this.loading = true
    this.$http.get(`https://cdn.rawgit.com/lukes/ISO-3166-Countries-with-Regional-Codes/d4031492/all/all.json`
    ).then(response => {
      this.loading = false
      let options = []
      for (let country of response.data) {
        options.push(country.name)
      }
      this.options = options
    }, response => {
      console.log('error')
    })
  }
})
</script>
