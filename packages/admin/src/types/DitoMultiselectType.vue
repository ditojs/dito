<template lang="pug">
.dito-multiselect(
  :class=`{
    'dito-multiselect--multiple': multiple,
    'dito-multiselect--open': isOpen,
    'dito-multiselect--loading': isLoading,
    'dito-multiselect--disabled': attributes.disabled,
    'dito-multiselect--has-errors': !!errorsElementId
  }`
)
  .dito-multiselect__inner(ref="inner")
    DitoInputAffixes(
      v-if="inputAffixesProps.hasPrefix"
      position="prefix"
      v-bind="inputAffixesProps.prefix"
      absolute
    )
    //- reka-ui filters the options by their labels, unless `search` does:
    ComboboxRoot.dito-multiselect__root(
      v-model="selectedOptions"
      v-model:open="isOpen"
      :multiple="multiple"
      :by="isSameOption"
      :disabled="attributes.disabled"
      :ignoreFilter="!!searchFilter"
      openOnClick
      openOnFocus
      :resetSearchTermOnBlur="resetsSearchTerm"
      :resetSearchTermOnSelect="resetsSearchTerm"
    )
      ComboboxAnchor.dito-multiselect__control
        //- Typing adds no tags, only `taggable` does, see `onEnter()`:
        TagsInputRoot.dito-multiselect__tags(
          v-if="multiple"
          v-model="selectedOptions"
          :displayValue="getLabelForOption"
          :delimiter="null"
          :disabled="attributes.disabled"
        )
          TagsInputItem.dito-multiselect__tag(
            v-for="option in selectedOptions"
            :key="getValueForOption(option)"
            :value="option"
            :class=`{
              'dito-multiselect__tag--unavailable': isUnavailableOption(option)
            }`
            :title=`
              isUnavailableOption(option) ? 'Not among the options' : null
            `
          )
            TagsInputItemText
            //- Named for what it does, not after the tag's text:
            TagsInputItemDelete.dito-multiselect__tag-remove(
              :aria-label="`Remove ${getLabelForOption(option)}`"
              :aria-labelledby="null"
            )
          ComboboxInput(
            asChild
            v-bind="inputProps"
          )
            TagsInputInput.dito-multiselect__input(:placeholder="placeholder")
        ComboboxInput.dito-multiselect__input(
          v-else
          v-bind="inputProps"
          :placeholder="placeholder"
        )
        DitoSpinner.dito-multiselect__spinner(
          v-if="isLoading"
        )
        ComboboxTrigger.dito-multiselect__trigger(
          v-else
          tabindex="-1"
          aria-label="Show options"
        )
      //- No portal, so that the styles apply. The list is fixed, so that
      //- scrolling panels don't clip it, and overlaps the control's border:
      ComboboxContent.dito-multiselect__content(
        v-if="!isLoading"
        position="popper"
        positionStrategy="fixed"
        :sideOffset="-1"
      )
        ComboboxViewport.dito-multiselect__viewport
          ComboboxItem.dito-multiselect__option.dito-multiselect__option--tag(
            v-if="tagOption"
            :value="tagOption"
            @select.prevent="onSelectTag"
          ) {{ tagOption.tag }}
          template(
            v-if="isGrouped"
          )
            ComboboxGroup(
              v-for="group in activeOptions"
              :key="group.label"
            )
              ComboboxLabel.dito-multiselect__group {{ group.label }}
              ComboboxItem.dito-multiselect__option(
                v-for="option in group.options"
                :key="getValueForOption(option)"
                :value="option"
                @select="onSelect($event, option)"
              ) {{ getLabelForOption(option) }}
          template(
            v-else
          )
            ComboboxItem.dito-multiselect__option(
              v-for="option in activeOptions"
              :key="getValueForOption(option)"
              :value="option"
              @select="onSelect($event, option)"
            ) {{ getLabelForOption(option) }}
          ComboboxEmpty.dito-multiselect__empty
            | {{ searchTerm ? 'No matching options' : 'No options' }}
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
import {
  computed,
  onMounted,
  ref,
  shallowRef,
  unref,
  watch,
  withKeys
} from 'vue'
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

// A select of one or `multiple` options, built on reka-ui's `Combobox`, with
// the values of multiple ones in its `TagsInput`. `searchable` filters the
// options by their labels, `search` asks a filter for them, and `taggable` adds
// what was typed as a new option.
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
    const inner = ref(null)
    const getInputElement = () =>
      inner.value?.querySelector('.dito-multiselect__input')
    const isOpen = ref(false)

    const field = useField(props, {
      // Only emit blur events once closed, see `onBlur()`. Picking options
      // emits change events, not the native ones of the input:
      getEvents: ({ onFocus }) => ({ onFocus, onBlur }),
      focusElement: () => {
        getInputElement()?.focus()
        isOpen.value = true
      },
      blurElement: () => {
        isOpen.value = false
        getInputElement()?.blur()
      }
    })
    const { value, focused, autofocus, services, getSchemaValue } = field

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
      isSelected,
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

    const selectedOptions = computed({
      get() {
        // Keep values without options visible, like ones from searches, once
        // the options are loaded. Taggable multiselects may have no options
        // besides their values.
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
      },

      set(option) {
        selectedValue.value = multiple.value
          ? (option || []).map(value => getValueForOption(value))
          : getValueForOption(option)
        field.onChange()
      }
    })

    const isSameOption = (option1, option2) => (
      option1 != null &&
      option2 != null &&
      getValueForOption(option1) === getValueForOption(option2)
    )

    const getDisplayValue = option =>
      !multiple.value && option ? String(getLabelForOption(option)) : ''

    // Single selects show the label of their option in the input, which isn't
    // a search:
    const query = computed(() =>
      searchTerm.value === getDisplayValue(selectedOptions.value)
        ? ''
        : searchTerm.value?.trim() ?? ''
    )

    // The option to add the search term as a tag, unless an option has it as
    // its label:
    const tagOption = computed(() => {
      const tag = query.value
      if (!taggable.value || !tag || isLoading.value) return null
      const getOptions = options =>
        isGrouped.value ? options.flatMap(group => group.options) : options
      const exists = getOptions(activeOptions.value).some(
        option => getLabelForOption(option) === tag
      )
      return exists ? null : { tag }
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

    const onAddTag = tag => {
      const { label: toLabel, value: toValue } = isObject(taggable.value)
        ? taggable.value
        : {}
      const context = field.createContext({ value: tag })
      const value = toValue ? toValue(context) : tag
      const labelKey = optionLabel.value
      const valueKey = optionValue.value
      // Select existing options instead of adding duplicates:
      const isObjectOption = !!(labelKey && valueKey)
      const existingOption = isObjectOption ? getOptionForValue(value) : null
      const option = (
        existingOption ?? (
          isObjectOption
            ? {
                [labelKey]: toLabel ? toLabel(context) : tag,
                [valueKey]: value
              }
            : value
        )
      )
      if (!existingOption) {
        addedTagOptions.value.push(option)
      }
      // `selectedOptions` emits the change:
      if (!multiple.value) {
        selectedOptions.value = option
        isOpen.value = false
      } else if (!isSelected(option)) {
        selectedOptions.value = [...selectedOptions.value, option]
      }
      searchTerm.value = getDisplayValue(selectedOptions.value)
    }

    // reka-ui selects the highlighted option on Enter. Without one, Enter adds
    // the search term as a tag, and keeps `TagsInput` from adding it as typed:
    const onEnter = event => {
      const highlighted = event.target
        .closest('.dito-multiselect')
        .querySelector('[data-highlighted]')
      if (!highlighted && (multiple.value || tagOption.value)) {
        event.preventDefault()
        if (tagOption.value) {
          onAddTag(tagOption.value.tag)
        }
      }
    }

    const onInputFocus = event => {
      // Typing replaces the label that single selects show:
      if (!multiple.value && searchable.value) {
        event.target.select()
      }
    }

    // The props of the input, in `TagsInput` for multiple values:
    const inputProps = computed(() => {
      const { onFocus, ...attributes } = field.attributes.value
      return {
        ...attributes,
        'id': unref(field.componentPath),
        'modelValue': searchTerm.value,
        'onUpdate:modelValue': term => {
          searchTerm.value = term
        },
        'displayValue': getDisplayValue,
        'readonly': !searchable.value,
        'aria-label': field.labelText.value,
        'onFocus': [onFocus, onInputFocus],
        'onKeydown': withKeys(onEnter, ['enter'])
      }
    })

    watch(query, query => {
      if (searchFilter.value) {
        search(query)
      }
    })

    watch(isOpen, isOpen => {
      // Emit the blur event held back while the multiselect was open:
      if (!isOpen && focused.value) {
        onBlur()
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
      inner,
      inputProps,
      isOpen,
      selectedOptions,
      tagOption,
      searchTerm,
      searchable,
      taggable,
      multiple,
      isLoading,
      isSameOption,
      getDisplayValue,
      // Single values show the label of their option again. Multiple values
      // keep the term of their `search` for more picks:
      resetsSearchTerm: computed(() => !multiple.value || !searchFilter.value),
      onAddTag,

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

      onSelect(event, option) {
        // reka-ui closes single selects and keeps multiple ones open:
        if (multiple.value) {
          if (!stayOpen.value) {
            isOpen.value = false
          }
        } else if (stayOpen.value) {
          event.preventDefault()
          selectedOptions.value = option
        }
      },

      onSelectTag() {
        // Enter may have added the tag already, see `onEnter()`:
        if (tagOption.value) {
          onAddTag(tagOption.value.tag)
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

$tag-remove-width: 1.8em;
$tag-margin: 2px;
$tag-padding: 3px;

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
    padding: $tag-padding 0 $tag-padding 0.8em;
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

  // The icon fills the button, see `%icon`:
  &__tag-remove {
    position: relative;
    align-self: stretch;
    width: $tag-remove-width;
    padding: 0;
    border: 0;
    border-radius: 1em;
    background: none;
    cursor: pointer;

    &::after {
      @extend %icon--clear;

      font-size: 0.9em;
      color: $color-text-inverted;
    }

    &:hover::after {
      color: $color-text;
    }
  }

  &__input {
    @include ellipsis;

    flex: 1 0 4em;
    min-width: 0;
    padding: $input-padding;
    border: 0;
    font: inherit;
    color: inherit;
    background: none;
    outline: none;

    &::placeholder {
      color: $color-placeholder;
    }

    // Only show the placeholder next to tags while searching:
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
    padding: 0;
    border: 0;
    background: none;

    &::before {
      @include arrow($select-arrow-size);

      position: absolute;
      bottom: $select-arrow-bottom;
      right: $select-arrow-right;
    }
  }

  &__spinner {
    justify-content: center;
    align-items: center;
  }

  // reka-ui gives the list's z-index to the element that positions it:
  &__content {
    z-index: $z-index-popup;
    box-sizing: border-box;
    width: var(--reka-combobox-trigger-width);
    border: $border-style;
    border-color: $color-active;
    border-radius: $border-radius;
    background: $color-white;

    &[data-side='bottom'] {
      border-top-color: $border-color;
      border-top-left-radius: 0;
      border-top-right-radius: 0;
    }

    &[data-side='top'] {
      border-bottom-color: $border-color;
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
    }
  }

  &__viewport {
    max-height: 300px;
  }

  &__option,
  &__group,
  &__empty {
    padding: $input-padding;
    line-height: $line-height;
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

  &--open:has(#{$self}__content[data-side='bottom']) &__control {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  &--open:has(#{$self}__content[data-side='top']) &__control {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
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
