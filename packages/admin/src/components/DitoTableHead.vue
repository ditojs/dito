<template lang="pug">
thead.dito-table-head
  tr(
    v-for="headerGroup in table.getHeaderGroups()"
    :key="headerGroup.id"
  )
    template(
      v-for="header in headerGroup.headers"
      :key="header.id"
    )
      //- Columns that Dito adds have no schema. Their empty <span> is for the
      //- styles of the head:
      th(
        v-if="!header.column.columnDef.meta"
        :style="getColumnStyle(header.column)"
      )
        span
      th(
        v-else
        scope="col"
        :class="getColumnClass(header.column)"
        :style="getColumnStyle(header.column)"
        :aria-sort="getSortState(header.column)"
        :draggable="isDraggable(header.column)"
        @dragstart="onDragStart($event, header.column)"
        @dragover="onDragOver($event, header.column)"
        @dragleave="dropId = null"
        @drop="onDrop(header.column)"
        @dragend="dragId = dropId = null"
      )
        DitoButton(
          v-if="header.column.getCanSort()"
          :class="getSortClass(header.column)"
          @click="header.column.toggleSorting()"
        )
          .dito-button__order-arrows
          span {{ getLabelText(header.column.columnDef.meta.schema) }}
        span(
          v-else
        ) {{ getLabelText(header.column.columnDef.meta.schema) }}
        //- Drag to resize the column, double-click to reset its width:
        .dito-table-head__resize(
          v-if="header.column.getCanResize()"
          :class=`{
            'dito-table-head__resize--active': header.column.getIsResizing()
          }`
          @mousedown.prevent="header.getResizeHandler()($event)"
          @touchstart="header.getResizeHandler()($event)"
          @dblclick="header.column.resetSize()"
        )
</template>

<script>
import { ref } from 'vue'
import { DitoButton } from '@ditojs/ui/src'
import { hyphenate } from '@ditojs/utils'
import { useSchemaValue } from '../composables/useSchemaValue.ts'
import { getColumnStyle } from '../composables/useListTable.ts'

const sortStates = { asc: 'ascending', desc: 'descending' }

export default {
  components: { DitoButton },

  props: {
    table: { type: Object, required: true },
    // For the callbacks of the columns, like for the cells:
    context: { type: Object, required: true }
  },

  setup(props) {
    // Columns with `draggable` move by dragging their headers onto others:
    const dragId = ref(null)
    const dropId = ref(null)
    const isDraggable = column => !!column.columnDef.meta.schema.draggable

    return {
      ...useSchemaValue(props.context),
      getColumnStyle,
      dragId,
      dropId,
      isDraggable,

      getColumnClass(column) {
        return {
          [`dito-column--${hyphenate(column.id)}`]: true,
          'dito-table-head__column--resizable': column.getCanResize(),
          'dito-table-head__column--drop': column.id === dropId.value
        }
      },

      getSortClass(column) {
        const order = column.getIsSorted()
        return order
          ? `dito-button--selected dito-button--order-${order}`
          : null
      },

      getSortState(column) {
        return column.getCanSort()
          ? sortStates[column.getIsSorted()] || 'none'
          : null
      },

      onDragStart(event, column) {
        if (isDraggable(column)) {
          dragId.value = column.id
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', column.id)
        }
      },

      onDragOver(event, column) {
        if (dragId.value && isDraggable(column)) {
          event.preventDefault()
          dropId.value = column.id
        }
      },

      onDrop(column) {
        const ids = props.table.getAllLeafColumns().map(({ id }) => id)
        const from = ids.indexOf(dragId.value)
        ids.splice(ids.indexOf(column.id), 0, ...ids.splice(from, 1))
        props.table.setColumnOrder(ids)
      }
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-table-head {
  @include user-select(none);

  tr {
    th {
      padding: 0;
      font-weight: normal;
      text-align: left;
      white-space: nowrap;

      .dito-button {
        // Convention: Nested spans handle padding, see below
        display: block; // Override default inline-flex positioning.
        padding: 0;
        width: 100%;
        text-align: inherit;
        border-radius: 0;
      }

      span {
        display: inline-block;
        // Convention: Nested spans handle padding
        padding: $input-padding;

        &:empty::after {
          // Prevent empty <th> from collapsing
          content: '\200b'; // zero-width space;
        }
      }

      > span {
        display: block;
      }
    }
  }

  // The headers of resizable columns hold their resize handles:
  &__column--resizable {
    position: relative;
  }

  &__column--drop {
    box-shadow: inset 2px 0 $color-active;
  }

  // On the right edge of the header, after the label with its borders:
  &__resize {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 6px;
    cursor: col-resize;
    touch-action: none;

    &:hover,
    &--active {
      background: $color-active;
    }
  }
}
</style>
