<template lang="pug">
  .dito-multiselect(
    :class=`{
      'dito-multiselect-single': !multiple,
      'dito-multiselect-multiple': multiple
    }`
  )
    vue-multiselect(
      ref="element"
      v-model="selectedOptions"
      v-bind="attributes"
      v-on="listeners"
      :show-labels="false"
      :placeholder="placeholder"
      tag-placeholder="Press enter to add new tag",
      :options="populate && activeOptions || []"
      :custom-label="getLabelForOption"
      :track-by="optionValue"
      :group-label="groupByLabel"
      :group-values="groupByOptions"
      :multiple="multiple"
      :taggable="taggable"
      :searchable="searchable"
      :internal-search="!searchFilter"
      :preserve-search="!!searchFilter"
      :clear-on-select="!searchFilter"
      :close-on-select="!stayOpen"
      :loading="isLoading"
      @open="populate = true"
      @tag="onAddTag"
      @search-change="onSearchChange"
    )
    button.dito-button-clear.dito-button-overlay(
      type="button"
      v-if="showClearButton"
      @click="clear"
      :disabled="disabled"
    )
</template>

<style lang="sass">
  @import 'vue-multiselect/dist/vue-multiselect.min.css'

  $spinner-width: $select-arrow-width
  $tag-icon-width: 1.8em
  $tag-margin: 2px
  $tag-padding: 3px
  $tag-line-height: 1.1em

  .dito-multiselect
    position: relative

    .multiselect
      font-size: inherit
      min-height: inherit
      color: $color-black

    .multiselect__tags
      font-size: inherit
      overflow: auto
      min-height: inherit
      padding: 0 $spinner-width 0 0
      // So tags can float on multiple lines and have proper margins:
      padding-bottom: $tag-margin

    .multiselect__tag
      float: left
      margin: $tag-margin 0 0 $tag-margin
      border-radius: 1em
      padding: $tag-padding $tag-icon-width $tag-padding 0.8em
      line-height: $tag-line-height

    .multiselect__tags-wrap
      overflow: auto
      line-height: 0

    .multiselect__single,
    .multiselect__placeholder,
    .multiselect__input
      font-size: inherit
      line-height: inherit
      min-height: 0
      margin: 0 0 1px 0
      // Sadly, vue-select sets style="padding: ...;" in addition to using
      // classes, so `!important` is necessary:
      padding: $input-padding !important
      // So input can float next to tags and have proper margins with
      // .multiselect__tags:
      padding-bottom: 0 !important
      background: none

    .multiselect__placeholder,
    .multiselect__input::placeholder
      color: $color-placeholder

    .multiselect--active
      .multiselect__placeholder
        // Don't use `display: none` to hide place-holder, as the layout would
        // collapse.
        display: inline-block
        visibility: hidden

    .multiselect__select,
    .multiselect__spinner
      padding: 0
      // $border-width to prevent masking border with .multiselect__spinner
      top: $border-width
      right: $border-width
      bottom: $border-width
      height: inherit
      border-radius: $border-radius

    .multiselect__select
      width: 0
      margin-right: calc($select-arrow-width / 2)
      &::before
        +arrow($select-arrow-size)
        bottom: $select-arrow-bottom
        right: calc(-1 * $select-arrow-size / 2)

    .multiselect__spinner
      width: $spinner-width
      &::before,
      &::after
        // Change the width of the loading spinner
        border-width: 3px
        border-top-color: $color-active
        inset: 0
        margin: auto

    .multiselect__option
      min-height: unset
      height: unset
      line-height: $tag-line-height
      padding: $input-padding
      &::after
        // Instruction text for options
        padding: $input-padding
        line-height: $tag-line-height
    .multiselect__option--highlight
      &::after
        display: block
        position: absolute
        background: transparent
        color: $color-white
    .multiselect__option--disabled
      background: none
      color: $color-disabled

    .multiselect__tag-icon
      background: none
      border-radius: 1em
      font-weight: inherit
      line-height: 1.4em
      width: $tag-icon-width
      &::after
        color: $color-text-inverted
        font-size: 1.3em
      &:hover::after
        color: $color-text

    .multiselect__option--selected
      background: $color-highlight
      color: $color-text
      font-weight: normal
      &.multiselect__option--highlight
        color: $color-text-inverted

    .multiselect__tag,
    .multiselect__option--highlight
      background: $color-active
      color: $color-text-inverted

    .multiselect__tags,
    .multiselect__content-wrapper
      border: $border-style
      border-radius: $border-radius

    &.dito-multiselect-single
      --input-width: 100%
    &.dito-multiselect-multiple
      --input-width: auto

    .multiselect--active
      .multiselect__single,
      .multiselect__input
        // Sadly, vue-select sets `style="width"` in addition to using classes
        // so `!important` is necessary:
        width: var(--input-width) !important

      .multiselect__tags
        border-color: $color-active
        border-bottom-left-radius: 0
        border-bottom-right-radius: 0

      .multiselect__content-wrapper
        border: $border-width solid $color-active
        border-top-color: $border-color
        margin: -1px 0 0
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
          margin: 0 0 -1px
          border-radius: $border-radius
          border-bottom-left-radius: 0
          border-bottom-right-radius: 0

    &.dito-has-errors
      .multiselect__tags
        border-color: $color-error

    .dito-button-clear
      width: $spinner-width
</style>

<script>
import TypeComponent from '../TypeComponent.js'
import DitoContext from '../DitoContext.js'
import OptionsMixin from '../mixins/OptionsMixin.js'
import VueMultiselect from 'vue-multiselect'
import { getSchemaAccessor } from '../utils/accessor.js'
import 'vue-multiselect/dist/vue-multiselect.min.css'

// @vue/component
export default TypeComponent.register('multiselect', {
  components: { VueMultiselect },
  mixins: [OptionsMixin],

  data() {
    return {
      searchedOptions: null,
      populate: false
    }
  },

  computed: {
    selectedOptions: {
      get() {
        return this.multiple
          ? (this.selectedValue || [])
            .map(
              // If an option cannot be found, we may be in taggable mode and
              // can add it.
              value => this.getOptionForValue(value) || this.addTagOption(value)
            )
            // Filter out options that we couldn't match.
            // TODO: We really should display an error instead
            .filter(value => value)
          : this.selectedOption
      },

      set(option) {
        // Convert value to options object, since vue-multiselect can't map that
        // itself unfortunately. `track-by` is used for :key mapping it seems.
        this.selectedValue = this.multiple
          ? (option || []).map(value => this.getValueForOption(value))
          : this.getValueForOption(option)
      }
    },

    activeOptions() {
      return this.searchedOptions || this.options
    },

    multiple: getSchemaAccessor('multiple', {
      type: Boolean,
      default: false
    }),

    searchable: getSchemaAccessor('searchable', {
      type: Boolean,
      default: false
    }),

    taggable: getSchemaAccessor('taggable', {
      type: Boolean,
      default: false
    }),

    stayOpen: getSchemaAccessor('stayOpen', {
      type: Boolean,
      default: false
    }),

    placeholder() {
      const { placeholder, searchable, taggable } = this.schema
      return placeholder || (
        searchable && taggable ? 'Search or add a tag'
        : searchable ? 'Select or search entry'
        : undefined
      )
    }
  },

  mounted() {
    if (this.autofocus) {
      // vue-multiselect doesn't support the autofocus attribute. We need to
      // handle it here.
      this.focus()
    }
  },

  methods: {
    // @override
    getListeners() {
      // override `TypeMixin.getListeners()` to re-route 'input' to `onChange()`
      return {
        focus: this.onFocus,
        blur: this.onBlur,
        input: this.onChange
      }
    },

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

    focusElement() {
      this.$refs.element.activate()
    },

    onAddTag(tag) {
      const option = this.addTagOption(tag)
      if (option) {
        this.value.push(this.getValueForOption(option))
      }
    },

    async onSearchChange(query) {
      if (this.searchFilter) {
        if (query) {
          // Set `searchedOptions` to an empty array, before it will be
          // populated asynchronously with the actual results.
          this.searchedOptions = []
          this.searchedOptions = await this.resolveData(
            () => this.searchFilter(new DitoContext(this, { query }))
          )
        } else {
          // Clear `searchedOptions` when the query is cleared.
          this.searchedOptions = null
        }
      }
    }
  }
})
</script>
