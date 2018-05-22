<template lang="pug">
  vue-multiselect.dito-multiselect(
    :class="{ 'dito-mutiple': multiple }"
    v-model="multiSelectValue"
    v-validate="validations"
    v-bind="getAttributes()"
    v-on="getEvents()"
    :show-labels="false"
    :placeholder="placeholder"
    tag-placeholder="Press enter to add new tag",
    :options="options || []"
    :custom-label="getLabelForOption"
    :track-by="optionValue"
    :group-label="groupByLabel"
    :group-values="groupByOptions"
    :multiple="multiple"
    :searchable="searchable"
    :taggable="taggable"
    :internal-search="true"
    :close-on-select="true"
    :loading="loading"
    @tag="addTag"
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
  $tag-line-height: 1.2em

  .dito-multiselect
    display: inline-block
    font-size: inherit
    min-height: inherit
    width: auto
    color: $color-black

    .multiselect__tags
      overflow: auto
      min-height: inherit
      padding: 0 $spinner-width 0 0
      // So tags can float on multiple lines and have proper margins:
      padding-bottom: $tag-margin

    .multiselect__tag
      float: left
      margin: $tag-margin 0 0 $tag-margin
      border-radius: 1em
      padding: $tag-padding $tag-icon-size $tag-padding 0.8em

    .multiselect__tags-wrap
      overflow: auto
      margin: $tag-margin 0 0 $tag-margin
      line-height: 0

    .multiselect__single,
    .multiselect__input
      font-size: inherit
      padding: $input-padding
      // So input can float next to tags and have proper margins with
      // .multiselect__tags:
      padding-bottom: 0
      margin: 0
      line-height: $line-height
      background: none
      &::placeholder
        color: $color-placeholder

    &.dito-mutiple
      // Only srink and float the input field if we have mutliple values (tags).
      .multiselect__single,
      .multiselect__input
        float: left
        width: auto

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
      &::after
        line-height: $tag-line-height
        padding: $input-padding
    .multiselect__option--highlight
      &::after
        background: transparent
        color: $color-white

    .multiselect__tag-icon
      background: none
      border-radius: 1em
      font-weight: inherit
      top: inherit
      bottom: inherit
      line-height: 1em
      width: $tag-icon-size
      &::after
        color: $color-text-inverted
        font-size: 1.2em
      &:hover::after
        color: $color-text

    .multiselect__tag,
    .multiselect__option--highlight
      line-height: $tag-line-height
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
    multiSelectValue: {
      get() {
        return this.multiple
          ? (this.selectValue || [])
            .map(
              // If an option cannot be found, we may be in taggable mode and
              // can add it.
              value => this.getOptionForValue(value) || this.addTagOption(value)
            )
            // Filter out options that we couldn't match.
            // TODO: We really should display an error instead
            .filter(value => value)
          : this.getOptionForValue(this.selectValue)
      },

      set(option) {
        // Convert value to options object, since vue-multiselect can't map that
        // itself unfortunately. `track-by` is used for :key mapping it seems.
        this.selectValue = this.multiple
          ? (option || []).map(value => this.getValueForOption(value))
          : this.getValueForOption(option)
      }
    },

    multiple() {
      return this.getSchemaValue('multiple', true)
    },

    searchable() {
      return this.getSchemaValue('searchable', true)
    },

    taggable() {
      return this.getSchemaValue('taggable', true)
    },

    placeholder() {
      const { placeholder, searchable, taggable } = this.schema
      return placeholder || (
        searchable && taggable ? 'Search or add a tag'
        : searchable ? 'Select or search entry'
        : undefined
      )
    }
  },

  methods: {
    addTagOption(tag) {
      if (this.taggable) {
        const { optionLabel, optionValue } = this
        const option = optionLabel && optionValue
          ? {
            [optionLabel]: tag,
            // TODO: Define a simple schema option to convert the tag value to
            // something else, e.g. `toTag: tag => underscore(tag)`
            [optionValue]: tag
          }
          : tag
        this.options.push(option)
        return option
      }
    },

    addTag(tag) {
      const option = this.addTagOption(tag)
      if (option) {
        this.value.push(this.getValueForOption(option))
      }
    },

    focus() {
      this.$refs.element.activate()
    }
  }
})
</script>
