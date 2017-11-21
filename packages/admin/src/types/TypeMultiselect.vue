<template lang="pug">
  vue-multiselect.dito-multiselect(
    v-model="selectValue"
    :data-vv-name="name"
    v-validate="validations"
    :show-labels="false"
    :placeholder="schema.placeholder"
    :options="options || []"
    :label="labelKey"
    :track-by="valueKey"
    :group-label="groupLabelKey"
    :group-values="groupOptionsKey"
    :searchable="schema.searchable"
    :multiple="schema.multiple"
    :internal-search="true"
    :close-on-select="true"
    :loading="loading"
  )
</template>

<style lang="sass">
@import '~vue-multiselect/dist/vue-multiselect.min.css'

.dito
  $spinner-size: 1.3em
  $spinner-width: $spinner-size + $select-right-margin - $select-arrow-size / 2
  $tag-icon-size: 1.8em
  $tag-margin: 2px
  $tag-padding: 3px

  .dito-multiselect
    display: inline-block
    font-size: inherit
    min-height: inherit
    width: auto

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
        +arrow($select-arrow-size)
        bottom: 2px
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

    .multiselect__tag
      margin: 0 $tag-margin $tag-margin 0
      border-radius: 1em
      padding: $tag-padding $tag-icon-size $tag-padding 0.8em

    .multiselect__tags
      overflow: auto
    .multiselect__tags-wrap
      float: left
      margin: $tag-margin 0 0 $tag-margin
      line-height: 0

    .multiselect__tag-icon
      background: none
      border-radius: 1em
      font-weight: inherit
      top: inherit
      bottom: inherit
      line-height: inherit
      width: $tag-icon-size
      &::after
        color: $color-text-inverted
        font-size: 1.2em
      &:hover::after
        color: $color-text

    .multiselect__tag,
    .multiselect__option--highlight
      line-height: 1.2em
      background: $color-active
      color: $color-text-inverted

    .multiselect__option--selected
      background: $color-highlight
      color: $color-text
      font-weight: normal
      &.multiselect__option--highlight
        color: $color-text-inverted

    .multiselect__tags,
    .multiselect__content-wrapper
      border: $border-style
      border-radius: $border-radius

    &.multiselect--active
      .multiselect__tags
        border-color: $color-active
        border-bottom-left-radius: 0
        border-bottom-right-radius: 0
      .multiselect__content-wrapper
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
        .multiselect__content-wrapper
          border: $border-width solid $color-active
          border-bottom-color: $border-color
          margin-bottom: -1px
          border-radius: $border-radius
          border-bottom-left-radius: 0
          border-bottom-right-radius: 0
</style>

<script>
import TypeComponent from '@/TypeComponent'
import OptionsMixin from '@/mixins/OptionsMixin'
import VueMultiselect from 'vue-multiselect'

export default TypeComponent.register('multiselect', {
  mixins: [OptionsMixin],
  components: { VueMultiselect },

  computed: {
    selectValue: {
      get() {
        // Convert value to options object, since vue-multiselect can't map that
        // itself unfortunately. `track-by` is used for :key mapping it seems.
        const { value } = this
        return this.valueKey
          ? this.findOption(this.options, value, this.schema.options.groupBy)
          : value
      },
      set(value) {
        // When changes happend, store the mapped value instead of full object.
        this.value = this.valueKey
          ? value && value[this.valueKey]
          : value
      }
    }
  }
})
</script>
