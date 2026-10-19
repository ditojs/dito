<!-- eslint-disable vue/no-template-shadow -->
<template lang="pug">
.dito-pane(
  v-resize="onResizePane"
)
  //- Layout sections place the components themselves, with `DitoField` and
  //- `DitoPane`:
  slot(
    v-if="$slots.default"
  )
  template(
    v-for=`{
      schema,
      dataPath,
      nestedDataPath,
      itemDataPath,
      nested,
      store,
      shouldRender
    }, index in entries`
    v-else
  )
    //- A <span>, for the `.dito-container:first-of-type` selector:
    span.dito-pane__break(
      v-if="['before', 'both'].includes(schema.break)"
    )
    DitoContainer(
      v-if="shouldRender"
      ref="containers"
      :key="nestedDataPath"
      :data-index="index"
      :schema="schema"
      :dataPath="dataPath"
      :data="data"
      :itemDataPath="itemDataPath"
      :store="store"
      :single="single"
      :nested="nested"
      :disabled="disabled"
      :compact="compact"
      :generateLabels="generateLabels"
      :verticalLabels="isInLabeledRow(index)"
    )
    span.dito-pane__break(
      v-if="['after', 'both'].includes(schema.break)"
    )
</template>

<script>
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'

// The components of panes in rows that wrap, aligned to the labels in them:
export default {
  props: {
    entries: { type: Array, required: true },
    data: { type: Object, default: null },
    single: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    compact: { type: Boolean, default: false },
    generateLabels: { type: Boolean, default: false }
  },

  setup(props) {
    const containers = useTemplateRef('containers')
    const positions = ref([])

    const verticalLabelsByIndices = computed(() => {
      // Removed containers don't necessarily resize the pane:
      const renderedPositions = positions.value.map((position, index) =>
        props.entries[index]?.shouldRender ? position : null
      )

      const findNextPosition = index => {
        for (let i = index + 1; i < renderedPositions.length; i++) {
          if (renderedPositions[i]) return renderedPositions[i]
        }
        return 0
      }

      // Rows wrap back to the left, also with components aligned vertically:
      const isLastInRow = index => (
        renderedPositions[index] && (
          index === renderedPositions.length - 1 ||
          findNextPosition(index).left <= renderedPositions[index].left
        )
      )

      const rows = []
      let row = []
      for (let index = 0; index < renderedPositions.length; index++) {
        row.push(index)
        if (isLastInRow(index)) {
          rows.push(row)
          row = []
        }
      }
      if (row.length > 0) {
        rows.push(row)
      }

      const verticalLabelsByIndices = []
      for (const row of rows) {
        // Compact labels display next to their components, so only count the
        // ones of containers higher than one line.
        const hasLabelsInRow = row.some(
          index => (
            renderedPositions[index]?.height > 2 &&
            props.entries[index].isLabelled
          )
        )
        for (const index of row) {
          verticalLabelsByIndices[index] = hasLabelsInRow
        }
      }
      return verticalLabelsByIndices
    })

    watch(
      () => props.entries.length,
      length => {
        positions.value.length = length
      }
    )

    return {
      positions,

      isInLabeledRow(index) {
        return !!verticalLabelsByIndices.value[index]
      },

      onResizePane() {
        nextTick(() => {
          // The containers aren't rendered anymore if the pane was emptied or
          // unmounted in the meantime.
          for (const container of containers.value ?? []) {
            const node = container.$el
            const index = +node.dataset.index
            const bounds = node.getBoundingClientRect()
            const style = getComputedStyle(node)
            const padding = parseFloat(style.padding)
            const fontSize = parseFloat(style.fontSize)
            const height = bounds.height - 2 * padding
            positions.value[index] =
              height <= 0 ? null : { left: bounds.x, height: height / fontSize }
          }
        })
      }
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-pane {
  $self: &;
  $root-padding: $content-padding - $form-spacing-half;

  --pane-padding: 0px;
  --container-padding: #{$form-spacing-half};

  display: flex;
  position: relative;
  flex-flow: row wrap;
  align-items: flex-start;
  align-content: flex-start;
  // Remove the padding added by `.dito-container` inside `.dito-pane`:
  margin: -$form-spacing-half;
  padding: var(--pane-padding);
  // Use `flex: 0%` for all `.dito-pane` except `.dito-pane__main`,
  // so that the `.dito-buttons--main` can be moved all the way to the bottom.
  flex: 0%;

  &__main {
    flex: 100%;
  }

  &--padding-root {
    // A root-level pane inside a scroll view. Clear negative margin from above.
    margin: 0;
    // Move the negative margin used to remove the padding added by
    // `.dito-container` inside `.dito-pane` to the padding:
    --pane-padding: #{$root-padding};

    &#{$self}--single {
      --pane-padding: #{$content-padding};
      --container-padding: 0px;
    }

    &:has(> .dito-container--label-vertical:first-of-type) {
      // Reduce top spacing when the first row has labels.
      margin-top: -$form-spacing-half;
    }

    // Display a ruler between the tabbed components and the main components.
    // `dito-pane__tab` and `dito-pane__main` are set on the panes themselves,
    // see `DitoSchema`:
    &#{$self}__tab + #{$self}__main {
      &::before {
        // Use a pseudo element to display a ruler with proper margins
        display: block;
        content: '';
        width: 100%;
        border-bottom: $border-style;
        // Shift ruler up by $root-padding to exclude removed $form-spacing-half
        margin: (-$root-padding) $form-spacing-half $root-padding;
        padding: $form-spacing-half;
      }
    }
  }

  &--padding-inlined {
    --pane-padding: 0px;
  }

  &--padding-nested {
    --pane-padding: #{$form-spacing};

    &:has(> .dito-container--label-vertical:first-of-type) {
      // Reduce top spacing when the first row has labels.
      padding-top: $form-spacing-half;
    }
  }

  &--layout {
    // Panes in layouts sit next to fields, not inside containers with padding:
    margin: 0;
  }

  &__break {
    // `&_break` is rendered as <span> so we can use the
    // `.dito-container:first-of-type` selector to match the first container
    // even if it has a break before it.
    display: block;
    flex: 100%;
    height: 0;
  }
}
</style>
