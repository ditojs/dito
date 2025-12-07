<template lang="pug">
.dito-multiselect
  .dito-multiselect__inner
    VueMultiselect(
      ref="element"
      v-model="selectedOptions"
      :class=`{
        'multiselect--multiple': multiple,
        'multiselect--loading': isLoading,
        'multiselect--highlight': showHighlight
      }`
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
      :loading="isLoading"
      v-bind="attributes"
      @open="onOpen"
      @close="onClose"
      @tag="onAddTag"
      @search-change="onSearchChange"
    )
    button.dito-button-clear.dito-button-overlay(
      v-if="showClearButton"
      type="button"
      :disabled="disabled"
      @click="clear"
    )
  //- Edit button is never disabled, even if the field is disabled.
  DitoEditButtons(
    v-if="editable"
    :schema="schema"
    :dataPath="dataPath"
    :data="data"
    :meta="meta"
    :store="store"
    :disabled="false"
    :editable="editable"
    :editPath="editPath"
  )
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import DitoContext from '../DitoContext.js'
import TypeMixin from '../mixins/TypeMixin.js'
import OptionsMixin from '../mixins/OptionsMixin.js'
import VueMultiselect from 'vue-multiselect'
import { getSchemaAccessor } from '../utils/accessor.js'
import { isBoolean } from '@ditojs/utils'

// @vue/component
export default DitoTypeComponent.register('multiselect', {
  mixins: [OptionsMixin],
  components: { VueMultiselect },

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
                value => (
                  this.getOptionForValue(value) || this.addTagOption(value)
                )
              )
              // Filter out options that we couldn't match.
              // TODO: Should we display an error instead?
              .filter(Boolean)
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

    placeholder() {
      let { placeholder, searchable, taggable } = this.schema
      if (isBoolean(placeholder)) {
        placeholder = placeholder ? undefined : null
      }
      return placeholder === undefined
        ? searchable && taggable
          ? `Search or add a ${this.label}`
          : searchable
            ? `Select or search ${this.label}`
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
    addTagOption(tag) {
      if (this.taggable) {
        const { optionLabel, optionValue } = this
        const option =
          optionLabel && optionValue
            ? {
                [optionLabel]: tag,
                // TODO: Define a simple schema option to convert the tag value
                // to something else, e.g. `toTag: tag => underscore(tag)`
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

  &__inner {
    flex: 1;
    position: relative;
  }

  .dito-edit-buttons {
    margin-left: $form-spacing-half;
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

      .dito-has-errors & {
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
        // Instruction text for options
        padding: $input-padding;
        line-height: $tag-line-height;
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
          display: block;
          position: absolute;
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

    &__tag {
      color: $color-text-inverted;
      background: $color-active;
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
