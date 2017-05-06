<template lang="pug">
  VueMultiselect.dito-multiselect(
    :value="value",
    @input="onChanged",
    :show-labels="false",
    :placeholder="desc.placeholder",
    :options="options || []",
    :label="labelKey",
    :track-by="valueKey",
    :group-label="groupLabelKey",
    :group-values="groupOptionsKey",
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
  $spinner-size: 1.3em
  $spinner-width: $spinner-size + $select-right-margin - $select-arrow-size / 2
  $tag-icon-size: 1.8em

  .dito-multiselect
    display: inline-block
    font-size: inherit
    min-height: inherit

    .multiselect__input
      padding: $input-padding
      line-height: $line-height
      background: none

    .multiselect__tags
      min-height: inherit
      padding: 0 $spinner-width 0 0

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
      margin-right: $select-right-margin
      &::before
        right: -$select-arrow-size / 2

    .multiselect__spinner
      width: $spinner-width
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
import OptionsMixin from '@/mixins/OptionsMixin'
import VueMultiselect from 'vue-multiselect'

export default DitoComponent.register('multiselect', {
  mixins: [OptionsMixin],
  components: {VueMultiselect},

  computed: {
    value() {
      // Convert value to options object, since vue-multiselect can't map that
      // itself unfortunately. `track-by` is only used for :key mapping I think.
      let value = this.data[this.name]
      return this.valueKey
          ? this.findOption(this.options, value, this.desc.options.groupBy)
          : value
    }
  },

  methods: {
    onChanged(value) {
      // When changes happend store the mapped value instead of the full object.
      this.data[this.name] = this.valueKey
          ? value && value[this.valueKey]
          : value
    }
  }
})
</script>
