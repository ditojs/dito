<template lang="pug">
  VueMultiselect.dito-multiselect(
    :value="value",
    @input="onChanged",
    :show-labels="false",
    :placeholder="desc.placeholder",
    :options="options",
    :label="desc.options.labelKey",
    :track-by="desc.options.valueKey",
    :group-label="desc.options.groupBy && 'name'",
    :group-values="desc.options.groupBy && 'options'",
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
    font-size: inherit
    min-height: inherit

    .multiselect__tags
      min-height: inherit
      padding: 0.5em
      padding-right: 3em

    .multiselect__select
      width: 3em
      padding: 0
      height: 100%
      &::before
        top: 60%

    .multiselect__option
      min-height: inherit
      padding: 0.5em

    .multiselect__tag
      margin: 0 0.5em 0 0

    .multiselect__option--selected
      background: Highlight
      color: HighlightText
      font-weight: normal

    .multiselect__tags,
    .multiselect__content
      border: $border-style
      border-radius: $border-radius

    &.multiselect--active
      .multiselect__tags
        border-bottom-left-radius: 0
        border-bottom-right-radius: 0
      .multiselect__content
        border: $border-style
        border-top: none
        border-top-left-radius: 0
        border-top-right-radius: 0

    &.multiselect--above
      .multiselect__tags
        border-radius: $border-radius
        border-top-left-radius: 0
        border-top-right-radius: 0
      .multiselect__content
        border: $border-style
        border-bottom: none
        border-radius: $border-radius
        border-bottom-left-radius: 0
        border-bottom-right-radius: 0

    .multiselect__tag,
    .multiselect__option--highlight
      line-height: inherit
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
import isObject from 'isobject'
import axios from 'axios'

export default DitoComponent.register('multiselect', {
  components: { VueMultiselect },

  data() {
    return {
      options: [],
      loading: false
    }
  },

  created () {
    const options = this.desc.options
    if (isObject(options)) {
      if (options.url) {
        this.loading = true
        // TODO: Use axios instead vue-resources
        axios.get(options.url)
          .then(response => {
            this.loading = false
            if (options.groupBy) {
              const grouped = {}
              this.options = response.data.reduce(function(results, option) {
                const name = option[options.groupBy]
                let entry = grouped[name]
                if (!entry) {
                  entry = grouped[name] = {
                    name: name, // :group-label
                    options: [] // :group-values
                  }
                  results.push(entry)
                }
                entry.options.push(option)
                return results
              }, [])
            } else {
              this.options = [...response.data]
            }
          })
          .catch(error => {
            // TODO: Handle and display error
            console.error(error)
            this.options = null
          })
      } else {
        // Whenw providing options.labelKey & options.valueKey, options.values
        // can be used to provide the data instead of options.url
        this.options = options.values
      }
    } else if (Array.isArray(options)) {
      // Use an array of strings to provide the values be shown and selected.
      this.options = options
    }
  },

  computed: {
    value() {
      // Convert value to options object, since vue-multiselect can't map that
      // itself unfortunately. `track-by` is only used for :key mapping I think.
      let value = this.data[this.name]
      const valueKey = this.desc.options.valueKey
      if (valueKey) {
        // Search for the option object with the given value and return the
        // whole object.
        for (let option of this.options) {
          if (value === option[valueKey]) {
            return option
          }
        }
      }
      return value
    }
  },

  methods: {
    onChanged(value) {
      // When changes happend store the mapped value instead of the full object.
      const valueKey = this.desc.options.valueKey
      this.data[this.name] = valueKey ? value[valueKey] : value
    }
  }
})
</script>
