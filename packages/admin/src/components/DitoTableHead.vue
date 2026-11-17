<template lang="pug">
thead.dito-table-head
  tr(
    v-for="headerGroup in table.getHeaderGroups()"
    :key="headerGroup.id"
  )
    template(
      v-for="{ id, column } in headerGroup.headers"
      :key="id"
    )
      //- The buttons column, with an empty <span> for the styles of the head:
      th(
        v-if="column.id === buttonsColumnId"
      )
        span
      th(
        v-else
        scope="col"
        :class="getColumnClass(column)"
        :aria-sort="column.getCanSort() ? getSortState(column) : null"
      )
        DitoButton(
          v-if="column.getCanSort()"
          :class="getSortClass(column)"
          @click="column.toggleSorting()"
        )
          .dito-button__order-arrows
          span {{ getLabelText(column.columnDef.meta.schema) }}
        span(
          v-else
        ) {{ getLabelText(column.columnDef.meta.schema) }}
</template>

<script>
import { DitoButton } from '@ditojs/ui/src'
import { hyphenate } from '@ditojs/utils'
import { useSchemaValue } from '../composables/useSchemaValue.ts'
import { buttonsColumnId } from '../composables/useListTable.ts'

const sortStates = { asc: 'ascending', desc: 'descending' }

export default {
  components: { DitoButton },

  props: {
    table: { type: Object, required: true },
    // For the callbacks of the columns, like for the cells:
    context: { type: Object, required: true }
  },

  setup(props) {
    return {
      ...useSchemaValue(props.context),
      buttonsColumnId,

      getColumnClass(column) {
        return `dito-column--${hyphenate(column.id)}`
      },

      getSortClass(column) {
        const order = column.getIsSorted()
        return order
          ? `dito-button--selected dito-button--order-${order}`
          : null
      },

      getSortState(column) {
        return sortStates[column.getIsSorted()] || 'none'
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
}
</style>
