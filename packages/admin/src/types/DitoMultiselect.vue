<template lang="pug">
  VueMultiselect.dito-multiselect(
    :value="value",
    @input="onChanged",
    :show-labels="false",
    :placeholder="desc.placeholder",
    :options="options || []",
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
.dito
  $spinner-size: 1.5em
  $tag-icon-size: 1.8em

  .dito-multiselect
    display: inline-block
    font-size: inherit
    min-height: inherit

    .multiselect__input
      padding: $input-padding
      line-height: $line-height

    .multiselect__tags
      min-height: inherit
      padding: 0 ($spinner-size + $select-right-margin) 0 0

    &.dito-has-errors
      .multiselect__tags
        border-color: $color-error

    .multiselect__select,
    .multiselect__spinner
      padding: 0
      // 2px to prevent masking border with .multiselect__spinner
      top: 2px
      right: 2px
      bottom: 2px
      height: inherit

    .multiselect__select
      width: 0
      margin-right: $select-right-margin + $select-arrow-size / 2
      &::before
        right: -$select-arrow-size / 2

    .multiselect__spinner
      width: $spinner-size + $select-right-margin
      &::before,
      &::after
        width: $spinner-size
        height: $spinner-size
        border-width: 3px
        border-top-color: $color-active
        top: 0
        left: 0
        right: 0
        bottom: 0
        margin: auto

    .multiselect__option
      min-height: unset
      padding: $input-padding
      line-height: inherit

    .multiselect__tag
      margin: 2px 0 0 2px
      border-radius: 1em
      padding: 0.2em $tag-icon-size 0.2em 0.8em

    .multiselect__tag-icon
      background: none
      border-radius: 1em
      font-weight: inherit
      top: inherit
      bottom: inherit
      width: $tag-icon-size
      line-height: 1em
      &::after
        color: $color-text-inverted
        font-size: 1.3em
      &:hover::after
        color: $color-text

    .multiselect__tag,
    .multiselect__option--highlight
      line-height: inherit
      background: $color-active
      color: $color-text-inverted

    .multiselect__option--selected
      background: $color-highlight
      color: $color-text
      font-weight: normal

    .multiselect__tags,
    .multiselect__content
      border: $border-style
      border-radius: $border-radius

    &.multiselect--active
      .multiselect__tags
        border-color: $color-active
        border-bottom-left-radius: 0
        border-bottom-right-radius: 0
      .multiselect__content
        border: $border-width solid $color-active
        border-top-color: $border-color
        margin-top: -1px
        border-top-left-radius: 0
        border-top-right-radius: 0

      &.multiselect--above
        .multiselect__tags
          border-radius: $border-radius
          border-top-left-radius: 0
          border-top-right-radius: 0
        .multiselect__content
          border: $border-width solid $color-active
          border-bottom-color: $border-color
          margin-bottom: -1px
          border-radius: $border-radius
          border-bottom-left-radius: 0
          border-bottom-right-radius: 0

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
            this.errors.add(this.name,
                error.response && error.response.data || error.message)
            this.options = null
            this.loading = false
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
      const options = this.desc.options
      const valueKey = options.valueKey

      function findOption(options, groupBy) {
        // Search for the option object with the given value and return the
        // whole object.
        if (options) {
          for (let option of options) {
            if (groupBy) {
              const found = findOption(option.options, false)
              if (found) {
                return found
              }
            } else if (value === option[valueKey]) {
              return option
            }
          }
        }
      }

      return valueKey ? findOption(this.options, options.groupBy) : value
    }
  },

  methods: {
    onChanged(value) {
      // When changes happend store the mapped value instead of the full object.
      const valueKey = this.desc.options.valueKey
      this.data[this.name] = valueKey ? value && value[valueKey] : value
    }
  }
})
</script>
