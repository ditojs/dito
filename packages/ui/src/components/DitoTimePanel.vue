<template lang="pug">
//- Clicks keep the focus in the field that the panel belongs to:
.dito-time-panel(
  @mousedown.prevent
)
  ul.dito-time-panel__column(
    v-for="column in columns"
    :key="column.name"
    role="listbox"
    :aria-label="column.label"
  )
    li.dito-time-panel__option(
      v-for="value in column.values"
      :key="value"
      role="option"
      :aria-selected="value === column.value"
      :class="{ 'dito-time-panel__option--selected': value === column.value }"
      @click="selectOption(column.name, value)"
    ) {{ String(value).padStart(2, '0') }}
</template>

<script>
const hours = [...Array(24).keys()]
const minutes = [...Array(60).keys()]
const parts = [
  { name: 'hour', label: 'Hour', values: hours },
  { name: 'minute', label: 'Minute', values: minutes },
  { name: 'second', label: 'Second', values: minutes }
]

// The panel in the popups of `DitoTimeInput` and `DitoDatePicker`, with a list
// of the values for each part of the time, of which it shows the selected ones
// in the middle. The values are times of `@internationalized/date`, or dates
// with a time, whose date it keeps.
export default {
  emits: ['update:modelValue', 'select'],

  props: {
    modelValue: { type: Object, required: true },
    // The smallest part that the panel shows, `hour`, `minute` or `second`:
    granularity: { type: String, default: 'minute' }
  },

  computed: {
    columns() {
      const { modelValue, granularity } = this
      const index = parts.findIndex(({ name }) => name === granularity)
      return parts
        .slice(0, index + 1)
        .map(part => ({ ...part, value: modelValue[part.name] }))
    }
  },

  watch: {
    modelValue(to, from) {
      if (to.compare(from) !== 0) {
        this.scrollToSelectedOptions({ smooth: true })
      }
    }
  },

  mounted() {
    this.scrollToSelectedOptions({ smooth: false })
  },

  methods: {
    selectOption(name, value) {
      this.$emit('update:modelValue', this.modelValue.set({ [name]: value }))
      // Tell the field which of its parts was picked:
      this.$emit('select', name)
    },

    scrollToSelectedOptions({ smooth }) {
      this.$nextTick(() => {
        const options = this.$el.querySelectorAll('[aria-selected="true"]')
        for (const option of options) {
          const list = option.parentElement
          // Center the selected option in the list:
          const top = Math.round(
            option.offsetTop -
            (list.clientHeight - option.offsetHeight) / 2
          )
          const distance = Math.abs(list.scrollTop - top)
          list.scrollTo({
            top,
            behavior: smooth && distance < 100 ? 'smooth' : 'auto'
          })
        }
      })
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

$time-panel-line-height: 24px;

.dito-time-panel {
  display: flex;

  &__column {
    // The offset parent of the options, see `scrollToSelectedOptions()`:
    position: relative;
    width: 4em;
    height: 7 * $time-panel-line-height;
    margin: 0;
    padding: 0;
    list-style: none;
    overflow-y: auto;
    scrollbar-width: none;

    &:not(:first-child) {
      border-left: $border-style;
    }
  }

  &__option {
    @include user-select(none);

    height: $time-panel-line-height;
    line-height: $time-panel-line-height;
    text-align: center;
    font-variant-numeric: tabular-nums;
    cursor: pointer;

    // Space to center the first and the last option:
    &:first-child {
      margin-top: 3 * $time-panel-line-height;
    }

    &:last-child {
      margin-bottom: 3 * $time-panel-line-height;
    }

    &:hover {
      background: $color-highlight;
    }

    &--selected {
      &,
      &:hover {
        color: $color-text-inverted;
        background: $color-active;
      }
    }
  }
}
</style>
