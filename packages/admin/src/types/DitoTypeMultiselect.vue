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
      :customLabel="option => getLabelForOption(option)"
      :trackBy="optionValue"
      :groupLabel="groupBy ? 'label' : null"
      :groupValues="groupBy ? 'options' : null"
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
      template(#singleLabel="{ option }")
        | {{ getLabelForOption(option) }}
      //- Mark values without options:
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
    :store="store"
    :optionValue="selectedValue"
  )
</template>

<script>
import { computed, onMounted, ref, shallowRef } from 'vue'
import { defineType } from '../utils/schema/types.ts'
import { optionsTraits } from './traits.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import { useOptions } from '../composables/useOptions.ts'
import DitoInputAffixes from '../components/DitoInputAffixes.vue'
import DitoOptionsEditButtons from '../components/DitoOptionsEditButtons.vue'
import VueMultiselect from 'vue-multiselect'
import { isArray, isBoolean, isObject, isString } from '@ditojs/utils'

// @vue/component
const DitoTypeMultiselect = {
  name: 'DitoTypeMultiselect',
  components: { DitoInputAffixes, DitoOptionsEditButtons, VueMultiselect },
  props: fieldProps,

  setup(props) {
    const field = useField(props, {
      // Only emit blur events once closed, see `onClose()`:
      getEvents: handlers => ({ ...handlers, onBlur }),
      focusElement: () => element.value.activate(),
      blurElement: () => element.value.deactivate()
    })
    const { element, value, focused, autofocus, services, getSchemaValue } =
      field
    const isMounted = ref(false)
    const populate = ref(false)
    const searchedOptions = shallowRef(null)
    const isLoadingSearchedOptions = ref(false)
    let currentSearchTerm = null
    let searchError = null
    const addedTagOptions = ref([])

    const getBoolean = key =>
      computed(() => getSchemaValue(key, { type: Boolean, default: false }))
    const multiple = getBoolean('multiple')
    const searchable = getBoolean('searchable')
    const taggable = getBoolean('taggable')

    const optionsField = useOptions(props, field, {
      multiple,
      addedOptions: addedTagOptions,
      searchedOptions
    })
    const {
      options,
      hasOptions,
      isLoadingOptions,
      optionsResolver,
      relate,
      optionLabel,
      optionValue,
      searchFilter,
      selectedValue,
      selectedOption,
      getValueForOption,
      getOptionForValue
    } = optionsField

    function onBlur() {
      if (!element.value.isOpen) {
        field.onBlur()
      }
    }

    // Values without options, like from searches, get an option that holds
    // them as value and label. Related objects are their own options:
    const getFallbackOption = value =>
      isObject(value) || !isString(optionValue.value)
        ? value
        : {
            [optionValue.value]: value,
            ...(isString(optionLabel.value) && {
              [optionLabel.value]: `${value}`
            })
          }

    const selectedOptions = computed({
      get() {
        // Keep values without options visible. Taggable multiselects may have
        // no options besides their values.
        const values = value.value
        return multiple.value
          ? (
              isArray(values) && (
                hasOptions.value ||
                taggable.value && !isLoadingOptions.value
              )
            )
            ? values.map(
                value => (
                  getOptionForValue(
                    relate.value ? getValueForOption(value) : value
                  ) || getFallbackOption(value)
                )
              )
            : []
          : selectedOption.value
      },

      set(option) {
        // vue-multiselect can't map options to values itself:
        selectedValue.value = multiple.value
          ? (option || []).map(value => getValueForOption(value))
          : getValueForOption(option)
        field.onChange()
      }
    })

    // Wait for the options, as the filter receives them. Return `null` on
    // errors:
    const loadSearchedOptions = async searchTerm => {
      // The error of a search replaces the one of the previous search:
      const { model } = services.container
      model.removeError(props.dataPath, searchError)
      searchError = null
      try {
        await optionsResolver.value.waitForValue()
        return await searchFilter.value(searchTerm)
      } catch (error) {
        searchError = error.message || error
        model.addError(props.dataPath, searchError)
        return null
      }
    }

    onMounted(() => {
      isMounted.value = true
      if (autofocus.value) {
        // vue-multiselect doesn't support the autofocus attribute:
        field.focus()
      }
    })

    return {
      ...field,
      ...optionsField,
      selectedOptions,
      populate,
      searchable,
      taggable,
      isLoadingSearchedOptions,

      stayOpen: getBoolean('stayOpen'),

      multiselectClasses: computed(() => {
        const prefix = 'multiselect'
        return {
          [`${prefix}--multiple`]: multiple.value,
          [`${prefix}--loading`]: (
            isLoadingOptions.value || isLoadingSearchedOptions.value
          ),
          [`${prefix}--highlight`]: (
            isMounted.value && element.value.pointerDirty
          )
        }
      }),

      placeholder: computed(() => {
        let { placeholder, searchable, taggable } = props.schema
        if (isBoolean(placeholder)) {
          placeholder = placeholder ? undefined : null
        }
        const { label } = props
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
      }),

      // See `getFallbackOption()`. Taggable multiselects hold any value:
      isUnavailableOption(option) {
        return (
          !taggable.value && (
            optionValue.value
              ? !getOptionForValue(getValueForOption(option))
              : !options.value.includes(option)
          )
        )
      },

      onOpen() {
        populate.value = true
      },

      onClose() {
        if (focused.value) {
          onBlur()
        }
      },

      onAddTag(tag) {
        if (taggable.value) {
          const label = optionLabel.value
          const key = optionValue.value
          const option =
            label && key
              ? {
                  [label]: tag,
                  // TODO: Define a simple schema option to convert the tag
                  // value to something else, e.g.
                  // `toTag: tag => underscore(tag)`
                  [key]: tag
                }
              : tag
          addedTagOptions.value.push(option)
          // `selectedOptions` emits the change:
          selectedOptions.value = multiple.value
            ? [...selectedOptions.value, option]
            : option
        }
      },

      async onSearchChange(searchTerm) {
        if (searchFilter.value) {
          currentSearchTerm = searchTerm
          if (searchTerm) {
            searchedOptions.value = []
            // Resolved promises return options without a loading indicator:
            const timer = setTimeout(() => {
              isLoadingSearchedOptions.value = true
            }, 0)
            const options = await loadSearchedOptions(searchTerm)
            clearTimeout(timer)
            // Ignore searches that newer ones replaced in the meantime:
            if (searchTerm === currentSearchTerm) {
              searchedOptions.value = options
              isLoadingSearchedOptions.value = false
            }
          } else {
            searchedOptions.value = null
            isLoadingSearchedOptions.value = false
          }
        }
      }
    }
  }
}

defineType({
  types: ['multiselect'],
  component: DitoTypeMultiselect,
  ...optionsTraits
})

export default DitoTypeMultiselect
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
