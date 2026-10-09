<template lang="pug">
.dito-multiselect
  .dito-multiselect__inner
    DitoInputAffixes(
      position="prefix"
      v-bind="inputAffixesProps.prefix"
      absolute
    )
    VueMultiselect(
      :id="componentPath"
      ref="element"
      v-model="selectedOptions"
      :aria-label="label"
      :class="multiselectClasses"
      :showLabels="false"
      :placeholder="placeholder"
      tagPlaceholder="Press enter to add new tag"
      :options="populate && activeOptions || []"
      :customLabel="getLabelForOption"
      :trackBy="optionValue"
      :groupLabel="groupByLabel"
      :groupValues="groupByOptions"
      :multiple="multiple"
      :taggable="taggable"
      :searchable="searchable"
      :internalSearch="!searchFilter"
      :preserveSearch="!!searchFilter"
      :clearOnSelect="!searchFilter"
      :closeOnSelect="!stayOpen"
      :loading="isLoadingOptions || isLoadingSearchedOptions"
      v-bind="attributes"
      @open="onOpen"
      @close="onClose"
      @tag="onAddTag"
      @search-change="onSearchChange"
    )
      //- The default tag, which marks values without options.
      template(#tag="{ option, remove }")
        span.multiselect__tag.dito-multiselect__tag(
          :class=`{
            'dito-multiselect__tag--unavailable': isUnavailableOption(option)
          }`
          :title="isUnavailableOption(option) ? 'Not among the options' : null"
          @mousedown.prevent
        )
          span {{ getLabelForOption(option) }}
          i.multiselect__tag-icon(
            tabindex="0"
            @keydown.enter.prevent="remove(option)"
            @mousedown.prevent="remove(option)"
          )
    DitoInputAffixes(
      position="suffix"
      v-bind="inputAffixesProps.suffix"
      absolute
      @clear="clear"
    )
  DitoOptionsEditButtons(
    v-if="editable"
    :schema="schema"
    :dataPath="dataPath"
    :data="data"
    :meta="meta"
    :store="store"
    :parentContext="context"
    :optionValue="selectedValue"
  )
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import DitoContext from '../DitoContext.js'
import TypeMixin from '../mixins/TypeMixin.js'
import OptionsMixin from '../mixins/OptionsMixin.js'
import DitoInputAffixes from '../components/DitoInputAffixes.vue'
import { getInputAffixesProps } from '../utils/affixes.js'
import DitoOptionsEditButtons from '../components/DitoOptionsEditButtons.vue'
import VueMultiselect from 'vue-multiselect'
import { getSchemaAccessor } from '../utils/accessor.js'
import { isArray, isBoolean, isObject, isString } from '@ditojs/utils'

// @vue/component
export default DitoTypeComponent.register('multiselect', {
  mixins: [OptionsMixin],
  components: { DitoInputAffixes, DitoOptionsEditButtons, VueMultiselect },

  data() {
    return {
      searchedOptions: null,
      isLoadingSearchedOptions: false,
      // The term of the current search, see `onSearchChange()`:
      currentSearchTerm: null,
      // The options of the tags that were added, see `onAddTag()`:
      addedTagOptions: [],
      populate: false
    }
  },

  computed: {
    inputAffixesProps() {
      return getInputAffixesProps(this)
    },

    selectedOptions: {
      get() {
        // Values without options stay visible once the options are loaded,
        // and are kept when the selection changes, see `getFallbackOption()`.
        // Taggable multiselects may have no options besides their values.
        return this.multiple
          ? (
              isArray(this.value) && (
                this.hasOptions ||
                this.taggable && !this.isLoadingOptions
              )
            )
            ? this.value.map(value => {
                const selectedValue = this.relate
                  ? this.getValueForOption(value)
                  : value
                return (
                  this.getOptionForValue(selectedValue) ||
                  this.getFallbackOption(value)
                )
              })
            : []
          : this.selectedOption
      },

      set(option) {
        // Convert value to options object, since vue-multiselect can't map that
        // itself unfortunately. `track-by` is used for :key mapping it seems.
        this.selectedValue = this.multiple
          ? (option || []).map(value => this.getValueForOption(value))
          : this.getValueForOption(option)
        this.onChange()
      }
    },

    // @override
    options() {
      const options = OptionsMixin.computed.options.call(this)
      // Add the options of the added tags that the options don't contain yet,
      // without modifying the options of the data model. Grouped options have
      // no group to add them to.
      const addedTagOptions = this.groupBy
        ? []
        : this.addedTagOptions.filter(
            option => !this.isOptionAmong(option, options)
          )
      return addedTagOptions.length > 0
        ? [...options, ...addedTagOptions]
        : options
    },

    activeOptions() {
      return this.searchedOptions || this.options
    },

    // @override
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

    multiselectClasses() {
      const prefix = 'multiselect'
      return {
        [`${prefix}--multiple`]: this.multiple,
        [`${prefix}--loading`]: (
          this.isLoadingOptions || this.isLoadingSearchedOptions
        ),
        [`${prefix}--highlight`]: this.showHighlight
      }
    },

    placeholder() {
      let { placeholder, searchable, taggable } = this.schema
      if (isBoolean(placeholder)) {
        placeholder = placeholder ? undefined : null
      }
      const { label } = this
      return placeholder === undefined
        ? searchable && taggable
          ? label
            ? `Search or add a ${label}`
            : 'Search or add'
          : searchable
            ? label
              ? `Select or search ${label}`
              : 'Select or search'
            : undefined
        : placeholder
    },

    showHighlight() {
      return this.isMounted && this.$refs.element.pointerDirty
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
    createTagOption(tag) {
      const { optionLabel, optionValue } = this
      return optionLabel && optionValue
        ? {
            [optionLabel]: tag,
            // TODO: Define a simple schema option to convert the tag value
            // to something else, e.g. `toTag: tag => underscore(tag)`
            [optionValue]: tag
          }
        : tag
    },

    // Returns whether `options` contain an option with the value of `option`.
    isOptionAmong(option, options) {
      const value = this.getValueForOption(option)
      return options.some(
        otherOption => this.getValueForOption(otherOption) === value
      )
    },

    // Returns whether the option is a fallback option for a value without
    // one, see `getFallbackOption()`. Plain options are their own values.
    // Taggable multiselects can hold any value.
    isUnavailableOption(option) {
      return (
        !this.taggable && (
          this.optionValue
            ? !this.getOptionForValue(this.getValueForOption(option))
            : !this.options.includes(option)
        )
      )
    },

    // Returns an option for a value without one, e.g. of options that only
    // hold the results of searches: Related objects are their own options,
    // other values get an option that holds them as value and label.
    getFallbackOption(value) {
      const { optionValue, optionLabel } = this
      return isObject(value) || !isString(optionValue)
        ? value
        : {
            [optionValue]: value,
            ...(isString(optionLabel) && { [optionLabel]: `${value}` })
          }
    },

    focusElement() {
      this.$refs.element.activate()
    },

    blurElement() {
      this.$refs.element.deactivate()
    },

    onOpen() {
      this.populate = true
    },

    onClose() {
      // Since we don't fire blur events while the multiselect is open (see
      // below), we need to do it here, when it's actually closed.
      if (this.focused) {
        this.onBlur()
      }
    },

    onBlur() {
      if (!this.$refs.element.isOpen) {
        TypeMixin.methods.onBlur.call(this)
      }
    },

    onAddTag(tag) {
      if (this.taggable) {
        const option = this.createTagOption(tag)
        this.addedTagOptions.push(option)
        // Select the option through `selectedOptions`, which emits the change:
        this.selectedOptions = this.multiple
          ? [...this.selectedOptions, option]
          : option
      }
    },

    // Returns the options that `searchFilter()` returns for the search term,
    // or `null` if it fails. Waits for the options, as the filter receives
    // them, e.g. to search them when the search term is entered while they are
    // still loading.
    async loadSearchedOptions(searchTerm) {
      try {
        await this.optionsResolver.waitForValue()
        return await this.searchFilter(new DitoContext(this, { searchTerm }))
      } catch (error) {
        this.addError(error.message || error)
        return null
      }
    },

    async onSearchChange(searchTerm) {
      if (this.searchFilter) {
        this.currentSearchTerm = searchTerm
        if (searchTerm) {
          // Set `searchedOptions` to an empty array, before it will be
          // populated asynchronously with the actual results.
          this.searchedOptions = []
          // Use a timeout to allow already resolved promises to return options
          // without showing a loading indicator.
          const timer = setTimeout(() => {
            this.isLoadingSearchedOptions = true
          }, 0)
          const options = await this.loadSearchedOptions(searchTerm)
          clearTimeout(timer)
          // Searches that were replaced by newer ones in the meantime neither
          // show their options nor end the loading state.
          if (searchTerm === this.currentSearchTerm) {
            this.searchedOptions = options
            this.isLoadingSearchedOptions = false
          }
        } else {
          // Clear `searchedOptions` when the query is cleared.
          this.searchedOptions = null
          this.isLoadingSearchedOptions = false
        }
      }
    }
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';
@import 'vue-multiselect/dist/vue-multiselect.css';

$spinner-width: $select-arrow-width;
$tag-icon-width: 1.8em;
$tag-margin: 2px;
$tag-padding: 3px;
$tag-line-height: 1em;

.dito-multiselect {
  display: inline-flex;
  position: relative;

  &__tag {
    color: $color-text-inverted;
    background: $color-active;

    // Values without options, see `getFallbackOption()`.
    &--unavailable {
      background: $color-grey;
    }
  }

  &__inner {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
  }

  .multiselect {
    $self: last-selector(&);

    --input-width: 100%;

    font-size: inherit;
    min-height: inherit;
    color: $color-black;

    &--multiple {
      --input-width: auto;
    }

    &__tags {
      display: flex;
      font-size: inherit;
      min-height: inherit;
      overflow: auto;
      padding: 0 $spinner-width 0 0;
      // So tags can float on multiple lines and have proper margins:
      padding-bottom: $tag-margin;

      .dito-container--has-errors & {
        border-color: $color-error;
      }
    }

    &__tag {
      float: left;
      margin: $tag-margin 0 0 $tag-margin;
      border-radius: 1em;
      padding: $tag-padding $tag-icon-width $tag-padding 0.8em;
      line-height: $tag-line-height;
      height: calc($input-height - 2 * $tag-padding);
    }

    &__tags-wrap {
      overflow: auto;
      line-height: 0;
    }

    &__single,
    &__placeholder,
    &__input {
      @include ellipsis;

      flex: 1 0 0%;
      width: 0;
      min-height: 0;
      margin: 0 0 1px 0;
      font-size: inherit;
      line-height: inherit;
      // Sadly, vue-select sets style="padding: ...;" in addition to using
      // classes, so `!important` is necessary:
      padding: $input-padding !important;
      // So input can float next to tags and have proper margins with
      // &__tags:
      padding-bottom: 0 !important;
      background: none;
    }

    &__placeholder,
    &__input::placeholder {
      color: $color-placeholder;
    }

    &__placeholder {
      &::after {
        // Enforce actual line-height for positioning.
        content: '\200b';
      }
    }

    &__select,
    &__spinner {
      padding: 0;
      // $border-width to prevent masking border with &__spinner
      top: $border-width;
      right: $border-width;
      bottom: $border-width;
      height: inherit;
      border-radius: $border-radius;
    }

    &__select {
      width: $select-arrow-width;

      &::before {
        @include arrow($select-arrow-size);

        bottom: $select-arrow-bottom;
        right: $select-arrow-right;
      }
    }

    &__spinner {
      width: $spinner-width;

      &::before,
      &::after {
        // Change the width of the loading spinner
        border-width: 3px;
        border-top-color: $color-active;
        inset: 0;
        margin: auto;
      }
    }

    &__option {
      $option: last-selector(&);

      min-height: unset;
      height: unset;
      line-height: $line-height;
      padding: $input-padding;

      &::after {
        // Instruction text for options (e.g. "Press enter to add new tag")
        position: static;
        height: auto;
        line-height: inherit;
        padding-left: $input-padding-hor;
      }

      // Only show the highlight once the pulldown has received mouse or
      // keyboard interaction, in which case `&--highlight` will be set,
      // which is controlled by `pointerDirty` in vue-multiselect.
      // Until then, clear the highlight style, but only if it isn't also
      // disabled or selected, in which case we want to keep the style.
      @at-root #{$self}:not(#{$self}--highlight)
          #{$option}:not(#{$option}--disabled):not(#{$option}--selected) {
        color: $color-text;
        background: transparent;
      }

      &--highlight {
        &::after {
          background: transparent;
          color: $color-white;
        }

        @at-root #{$self}#{$self}--highlight #{last-selector(&)} {
          color: $color-text-inverted;
          background: $color-active;
        }
      }

      &--selected {
        font-weight: normal;
        color: $color-text;
        background: $color-highlight;

        @at-root #{$self}#{$self}--highlight &#{$option}--highlight {
          color: $color-text-inverted;
        }
      }

      &--disabled {
        background: none;
        color: $color-disabled;
      }
    }

    &__tag-icon {
      background: none;
      border-radius: 1em;
      width: $tag-icon-width;
      margin: 0;

      &::after {
        @extend %icon-clear;

        font-size: 0.9em;
        color: $color-text-inverted;
      }

      &:hover::after {
        color: $color-text;
      }
    }

    &__tags,
    &__content-wrapper {
      border: $border-style;
      border-radius: $border-radius;
    }

    &__content-wrapper {
      z-index: $z-index-popup;
      border-color: $color-active;
    }

    &:not(&--above) #{$self}__content-wrapper {
      margin: (-$border-width) 0 0;
      border-top-color: $border-color;
      border-top-left-radius: 0;
      border-top-right-radius: 0;
    }

    &--above #{$self}__content-wrapper {
      margin: 0 0 (-$border-width);
      border-bottom-color: $border-color;
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
    }

    &--active {
      #{$self}__placeholder {
        // Don't use `display: none` to hide place-holder, as the layout would
        // collapse.
        display: inline-block;
        visibility: hidden;
      }

      #{$self}__single,
      #{$self}__input {
        // Sadly, vue-select sets `style="width"` in addition to using classes
        // so `!important` is necessary:
        width: var(--input-width) !important;
      }

      #{$self}__tags {
        border-color: $color-active;
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
      }

      &#{$self}--above {
        #{$self}__tags {
          border-radius: $border-radius;
          border-top-left-radius: 0;
          border-top-right-radius: 0;
        }
      }
    }

    &--loading {
      #{$self}__tags {
        border-radius: $border-radius;
      }

      #{$self}__content-wrapper {
        display: none;
      }
    }
  }
}
</style>
