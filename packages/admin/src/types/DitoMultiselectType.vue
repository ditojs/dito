<template lang="pug">
.dito-multiselect(
  :class=`{
    'dito-multiselect--open': isOpen,
    'dito-multiselect--disabled': attributes.disabled,
    'dito-multiselect--has-errors': !!errorsElementId
  }`
)
  .dito-multiselect__inner
    DitoInputAffixes(
      v-if="inputAffixesProps.hasPrefix"
      position="prefix"
      v-bind="inputAffixesProps.prefix"
      absolute
    )
    //- reka-ui filters the options by their labels, unless `search` does:
    ComboboxRoot.dito-multiselect__root(
      v-model="comboboxValue"
      v-model:open="isOpen"
      :multiple="multiple"
      :disabled="attributes.disabled"
      :ignoreFilter="!!searchFilter"
      openOnClick
      openOnFocus
    )
      ComboboxAnchor.dito-multiselect__control
        //- The tag option adds typed values, never `TagsInput` itself:
        TagsInputRoot.dito-multiselect__tags(
          v-if="multiple"
          v-model="comboboxValue"
          :delimiter="null"
          :disabled="attributes.disabled"
        )
          TagsInputItem.dito-multiselect__tag(
            v-for="option in selectedOptions"
            :key="getValueForOption(option)"
            :value="getValueForOption(option)"
            :class=`{
              'dito-multiselect__tag--unavailable': isUnavailableOption(option)
            }`
            :title=`
              isUnavailableOption(option) ? 'Not among the options' : null
            `
          )
            TagsInputItemText {{ getLabelForOption(option) }}
            TagsInputItemDelete.dito-multiselect__tag-remove
          ComboboxInput(
            ref="element"
            v-model="searchTerm"
            asChild
            v-bind="inputProps"
          )
            TagsInputInput.dito-multiselect__input(
              :placeholder="placeholder"
              @keydown.enter.prevent
            )
        ComboboxInput.dito-multiselect__input(
          v-else
          ref="element"
          v-model="searchTerm"
          v-bind="inputProps"
          :placeholder="placeholder"
        )
        DitoSpinner.dito-multiselect__spinner(
          v-if="isLoading"
        )
        ComboboxTrigger.dito-multiselect__trigger(
          v-else
          aria-label="Show options"
        )
      //- No portal, so that the styles apply. The list is fixed, so that
      //- scrolling panes don't clip it, and overlaps the control's border:
      ComboboxContent.dito-multiselect__content(
        position="popper"
        positionStrategy="fixed"
        :sideOffset="-1"
      )
        ComboboxViewport.dito-multiselect__viewport
          //- Keyed by the tag, as reka-ui reads the text of items once:
          ComboboxItem.dito-multiselect__option.dito-multiselect__option--tag(
            v-if="tagOption"
            :key="tagOption.tag"
            :value="tagOption"
            @select.prevent="addTag(tagOption.tag)"
          ) {{ tagOption.tag }}
          ComboboxGroup(
            v-for="group in optionGroups"
            :key="group.label"
          )
            ComboboxLabel.dito-multiselect__group(
              v-if="group.label"
            ) {{ group.label }}
            ComboboxItem.dito-multiselect__option(
              v-for="option in group.options"
              :key="getValueForOption(option)"
              :value="getValueForOption(option)"
              @select="onSelect"
            ) {{ getLabelForOption(option) }}
          ComboboxEmpty.dito-multiselect__empty
            | {{ isLoading ? 'Loading…' : 'No options' }}
    DitoInputAffixes(
      v-if="inputAffixesProps.hasSuffix"
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
import { computed, onMounted, ref, shallowRef, unref, watch } from 'vue'
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxViewport,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputItemText,
  TagsInputRoot
} from 'reka-ui'
import { defineType } from '../utils/schema/types.ts'
import { optionsTraits } from './traits.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import { useOptions } from '../composables/useOptions.ts'
import DitoInputAffixes from '../components/DitoInputAffixes.vue'
import DitoOptionsEditButtons from '../components/DitoOptionsEditButtons.vue'
import DitoSpinner from '../components/DitoSpinner.vue'
import { isArray, isBoolean, isObject } from '@ditojs/utils'

// Selects one or `multiple` options with reka-ui's `Combobox`, which holds
// their values. Multiple values show as tags in reka-ui's `TagsInput`.
// @vue/component
const DitoMultiselectType = {
  components: {
    ComboboxAnchor,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxGroup,
    ComboboxInput,
    ComboboxItem,
    ComboboxLabel,
    ComboboxRoot,
    ComboboxTrigger,
    ComboboxViewport,
    TagsInputInput,
    TagsInputItem,
    TagsInputItemDelete,
    TagsInputItemText,
    TagsInputRoot,
    DitoInputAffixes,
    DitoOptionsEditButtons,
    DitoSpinner
  },
  props: fieldProps,

  setup(props) {
    const isOpen = ref(false)
    const getInput = () => element.value?.$el
    const field = useField(props, {
      // Only emit blur events once closed, see `onBlur()`. Picking options
      // emits change events, not the native ones of the input:
      getEvents: ({ onFocus }) => ({ onFocus, onBlur }),
      focusElement: () => getInput()?.focus(),
      blurElement: () => {
        isOpen.value = false
        getInput()?.blur()
      }
    })
    const { element, value, focused, autofocus, services, getSchemaValue } =
      field

    function onBlur() {
      if (!isOpen.value) {
        field.onBlur()
      }
    }

    const searchTerm = ref('')
    const searchedOptions = shallowRef(null)
    const isLoadingSearchedOptions = ref(false)
    let currentSearchTerm = null
    let searchError = null
    const addedTagOptions = ref([])

    const getBoolean = key =>
      computed(() => getSchemaValue(key, { type: Boolean, default: false }))
    const multiple = getBoolean('multiple')
    const stayOpen = getBoolean('stayOpen')
    // `taggable` can be an object with `label` and `value` converters:
    const taggable = computed(() =>
      getSchemaValue('taggable', { type: [Boolean, Object], default: false })
    )

    const optionsField = useOptions(props, field, {
      multiple,
      addedOptions: addedTagOptions,
      searchedOptions
    })
    const {
      options,
      activeOptions,
      hasOptions,
      isGrouped,
      isLoadingOptions,
      optionsResolver,
      relate,
      optionLabel,
      optionValue,
      searchFilter,
      selectedValue,
      getLabelForOption,
      getValueForOption,
      getOptionForValue,
      getFallbackOption
    } = optionsField
    // `search` turns on searching, unless `searchable` is set:
    const searchable = computed(() =>
      getSchemaValue('searchable', {
        type: Boolean,
        default: !!searchFilter.value
      })
    )
    const isLoading = computed(
      () => isLoadingOptions.value || isLoadingSearchedOptions.value
    )

    // Keep values without options visible, like ones from searches, once the
    // options are loaded. Taggable multiselects may have no options besides
    // their values.
    const selectedOptions = computed(() => {
      const values = value.value
      const isShowingValues = (
        hasOptions.value ||
        taggable.value && !isLoadingOptions.value
      )
      const getOption = value => (
        getOptionForValue(relate.value ? getValueForOption(value) : value) ||
        getFallbackOption(value)
      )
      return multiple.value
        ? isShowingValues && isArray(values)
          ? values.map(getOption)
          : []
        : isShowingValues && values != null
          ? getOption(values)
          : null
    })

    // The combobox holds the values of the selected options, not the stored
    // ones, as `options.equals()` can match options to other values:
    const comboboxValue = computed({
      get() {
        const options = selectedOptions.value
        return multiple.value
          ? options.map(getValueForOption)
          : options != null
            ? getValueForOption(options)
            : null
      },

      set(newValue) {
        selectedValue.value = newValue
        field.onChange()
      }
    })

    // Single selects show the label of their option in the input:
    const getDisplayValue = () => {
      const option = multiple.value ? null : selectedOptions.value
      return option != null ? String(getLabelForOption(option)) : ''
    }

    // The label in the input isn't a search:
    const query = computed(() =>
      searchTerm.value === getDisplayValue() ? '' : searchTerm.value.trim()
    )

    // Ungrouped options are in one group without a label:
    const optionGroups = computed(() =>
      isGrouped.value
        ? activeOptions.value
        : [{ label: null, options: activeOptions.value }]
    )

    // The option to add the search term as a tag, unless an option has it as
    // its label:
    const tagOption = computed(() => {
      const tag = query.value
      return (
        taggable.value &&
        tag &&
        !isLoading.value &&
        !optionGroups.value.some(group =>
          group.options.some(option => getLabelForOption(option) === tag)
        )
      )
        ? { tag }
        : null
    })

    // Wait for the options, as the filter receives them. Return `null` on
    // errors:
    const loadSearchedOptions = async searchTerm => {
      // The error of a search replaces the one of the previous search:
      const { model } = services.dataContext
      model.errors.remove(props.dataPath, searchError)
      searchError = null
      try {
        await optionsResolver.value.waitForValue()
        return await searchFilter.value(searchTerm)
      } catch (error) {
        searchError = error.message || error
        model.errors.add(props.dataPath, searchError)
        return null
      }
    }

    const search = async searchTerm => {
      currentSearchTerm = searchTerm
      if (searchTerm) {
        // Show no options until the results of the search arrive:
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

    watch(query, query => {
      if (searchFilter.value) {
        search(query)
      }
    })

    watch(isOpen, isOpen => {
      if (!isOpen) {
        // reka-ui only resets the term when it closes the list itself:
        searchTerm.value = getDisplayValue()
        // Emit the blur event held back while the list was open, unless the
        // input keeps the focus:
        if (focused.value && !getInput()?.matches(':focus')) {
          onBlur()
        }
      }
    })

    // Typing replaces the label that single selects show:
    const onInputFocus = event => {
      if (!multiple.value && searchable.value) {
        event.target.select()
      }
    }

    const inputProps = computed(() => {
      const { onFocus, ...attributes } = field.attributes.value
      return {
        ...attributes,
        'id': unref(field.componentPath),
        'displayValue': getDisplayValue,
        'readonly': !searchable.value,
        'aria-label': field.labelText.value,
        'onFocus': [onFocus, onInputFocus]
      }
    })

    onMounted(() => {
      if (autofocus.value) {
        field.focus()
      }
    })

    return {
      ...field,
      ...optionsField,
      inputProps,
      isOpen,
      comboboxValue,
      selectedOptions,
      optionGroups,
      tagOption,
      searchTerm,
      multiple,
      isLoading,

      placeholder: computed(() => {
        let placeholder = getSchemaValue('placeholder', {
          type: [String, Boolean]
        })
        if (isBoolean(placeholder)) {
          placeholder = placeholder ? undefined : null
        }
        const label = field.labelText.value
        return placeholder === undefined
          ? searchable.value && taggable.value
            ? label
              ? `Search or add a ${label}`
              : 'Search or add'
            : searchable.value
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

      onSelect(event) {
        // reka-ui closes single selects and keeps multiple ones open:
        if (multiple.value) {
          if (!stayOpen.value) {
            isOpen.value = false
          }
        } else if (stayOpen.value) {
          event.preventDefault()
          comboboxValue.value = event.detail.value
        }
      },

      addTag(tag) {
        const { label: toLabel, value: toValue } = isObject(taggable.value)
          ? taggable.value
          : {}
        const context = field.createContext({ value: tag })
        const value = toValue ? toValue(context) : tag
        const labelKey = optionLabel.value
        const valueKey = optionValue.value
        // Select existing options instead of adding duplicates:
        const isObjectOption = !!(labelKey && valueKey)
        if (!(isObjectOption && getOptionForValue(value))) {
          addedTagOptions.value.push(
            isObjectOption
              ? {
                  [labelKey]: toLabel ? toLabel(context) : tag,
                  [valueKey]: value
                }
              : value
          )
        }
        if (!multiple.value) {
          comboboxValue.value = value
        } else if (!comboboxValue.value.includes(value)) {
          comboboxValue.value = [...comboboxValue.value, value]
        }
        searchTerm.value = getDisplayValue()
        if (!stayOpen.value) {
          isOpen.value = false
        }
      }
    }
  }
}

defineType({
  type: 'multiselect',
  component: DitoMultiselectType,
  hasSearch: true,
  ...optionsTraits
})

export default DitoMultiselectType
</script>

<style lang="scss">
@use 'sass:color';
@import '../styles/_imports';

$tag-margin: 2px;

.dito-multiselect {
  $self: &;

  display: inline-flex;
  position: relative;

  &__inner {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
  }

  &__root {
    flex: 1;
    min-width: 0;
  }

  &__control {
    @extend %input;

    display: flex;
    flex-wrap: wrap;
    align-items: center;
    position: relative;
    padding: 0 $select-arrow-width 0 0;
    max-height: 10em;
    overflow: auto;
  }

  // The tags and the input wrap together in the control:
  &__tags {
    display: contents;
  }

  &__tag {
    display: inline-flex;
    align-items: center;
    // As high as the input, so that tags don't make it taller:
    align-self: stretch;
    margin: $tag-margin 0 $tag-margin $tag-margin;
    border-radius: 1em;
    padding: 3px 0 3px 0.8em;
    line-height: 1em;
    color: $color-text-inverted;
    background: $color-active;

    // Values without options, see `getFallbackOption()`.
    &--unavailable {
      background: $color-grey;
    }

    // Selected with the arrow keys or Backspace, which then removes it:
    &[data-state='active'] {
      background: color.adjust($color-active, $lightness: -15%);
    }
  }

  &__tag-remove {
    @extend %button--plain;

    position: relative;
    align-self: stretch;
    width: 1.8em;
    border-radius: 1em;

    &::after {
      @extend %icon--clear;

      font-size: 0.9em;
    }

    &:hover {
      color: $color-text;
    }
  }

  &__input {
    @include ellipsis;

    flex: 1 0 4em;
    min-width: 0;
    padding: $input-padding;
    border: 0;
    color: inherit;
    background: none;

    &::placeholder {
      color: $color-placeholder;
    }

    // Only show the placeholder next to tags while the list is open:
    #{$self}:not(#{$self}--open) #{$self}__tag ~ &::placeholder {
      color: transparent;
    }

    &[readonly] {
      cursor: default;
    }
  }

  &__trigger,
  &__spinner {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: $select-arrow-width;
  }

  &__trigger {
    @extend %button--plain;

    &[data-state='open'] {
      transform: rotate(180deg);
    }

    &::before {
      @include arrow($select-arrow-size);

      bottom: $select-arrow-bottom;
      right: $select-arrow-right;
    }
  }

  &__spinner {
    justify-content: center;
  }

  // The list continues the input, so it has its border and no shadow:
  &__content {
    @extend %popup;

    box-sizing: border-box;
    width: var(--reka-combobox-trigger-width);
    border-color: $color-active;
    box-shadow: none;

    &[data-side='bottom'] {
      border-top-color: $border-color;
      border-radius: 0 0 $border-radius $border-radius;
    }

    &[data-side='top'] {
      border-bottom-color: $border-color;
      border-radius: $border-radius $border-radius 0 0;
    }
  }

  &__viewport {
    max-height: 300px;
  }

  &__option,
  &__group,
  &__empty {
    padding: $input-padding;
  }

  &__option {
    cursor: pointer;

    &[data-state='checked'] {
      background: $color-highlight;
    }

    &[data-highlighted] {
      color: $color-text-inverted;
      background: $color-active;
    }

    &[data-disabled] {
      color: $color-disabled;
      background: none;
      cursor: default;
    }

    &--tag::after {
      content: 'Press enter to add new tag';
      padding-left: $input-padding-hor;
      opacity: 0.6;
    }
  }

  &__group {
    font-weight: bold;
    background: $color-lightest;
  }

  &__empty {
    color: $color-placeholder;
  }

  // Join the open control and its list into one shape:
  &--open &__control {
    border-color: $color-active;
  }

  &:has(#{$self}__content[data-side='bottom']) &__control {
    border-radius: $border-radius $border-radius 0 0;
  }

  &:has(#{$self}__content[data-side='top']) &__control {
    border-radius: 0 0 $border-radius $border-radius;
  }

  &--disabled {
    #{$self}__control {
      @extend %field--disabled;
    }

    #{$self}__trigger::before {
      border-color: $color-disabled;
    }
  }

  // After the borders of the control, which it overrides:
  &--has-errors &__control {
    @extend %input--has-errors;
  }
}
</style>
