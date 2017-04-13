<template lang="pug">
  multiselect.dito-country(
    v-model="value",
    placeholder="Select Country",
    :options="options",
    :searchable="true",
    :internal-search="false",
    :close-on-select="true"
  )
</template>

<style src="vue-multiselect/dist/vue-multiselect.min.css"></style>
<style lang="sass">
  .dito-country
    width: unset
</style>

<script>
import TypeComponent from '@/TypeComponent'
import Multiselect from 'vue-multiselect'
import axios from 'axios'

export default TypeComponent.register('country', {
  components: { Multiselect },
  data () {
    return {
      value: '',
      options: []
    }
  },
  created () {
    const options = this.options
    axios.get('https://cdn.rawgit.com/lukes/ISO-3166-Countries-with-Regional-Codes/d4031492/all/all.json')
      .then(function (response) {
        const countries = response.data
        for (let country of countries) {
          options.push(country.name)
        }
      })
      .catch(function (error) {
        console.log(error)
      })
  }
})
</script>
