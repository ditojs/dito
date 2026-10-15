<template lang="pug">
thead.dito-table-head
  tr
    template(
      v-for="column in columns"
    )
      th(
        v-if="shouldRenderSchema(column)"
        scope="col"
        :class="getColumnClass(column)"
        :aria-sort="column.sortable ? getSortState(column) : null"
      )
        DitoButton(
          v-if="column.sortable"
          :class="getSortClass(column)"
          @click="sortByColumn(column)"
        )
          .dito-button__order-arrows
          span {{ getLabelText(column) }}
        span(
          v-else
        ) {{ getLabelText(column) }}
    th(
      v-if="hasEditButtons"
    )
      //- Empty <span> is needed for styling, see _table.scss
      span
</template>

<script>
import { computed } from 'vue'
import { DitoButton } from '@ditojs/ui/src'
import { hyphenate } from '@ditojs/utils'
import { useSchemaValue } from '../composables/useSchemaValue.ts'

export default {
  components: { DitoButton },

  props: {
    listQuery: { type: Object, required: true },
    columns: { type: Object, required: true },
    hasEditButtons: { type: Boolean, required: true },
    // For the callbacks of the columns, like for the cells:
    context: { type: Object, required: true }
  },

  setup(props) {
    const sort = computed(() => {
      const [name, order] = (props.listQuery.query.order || '').split(/\s+/)
      return { name, order }
    })

    return {
      ...useSchemaValue(props.context),

      getColumnClass(column) {
        return `dito-column--${hyphenate(column.name)}`
      },

      getSortClass(column) {
        const { name, order } = sort.value
        return name === column.name
          ? `dito-button--selected dito-button--order-${order}`
          : null
      },

      getSortState(column) {
        const { name, order } = sort.value
        const states = { asc: 'ascending', desc: 'descending' }
        return states[name === column.name && order] || 'none'
      },

      sortByColumn(column) {
        const { name, order } = sort.value
        // Toggle order if the same column is clicked again.
        const newOrder =
          name === column.name && order === 'asc' ? 'desc' : 'asc'
        // Sorting resets the page, as the sorted list has other pages.
        props.listQuery.update(
          { order: `${column.name} ${newOrder}` },
          { resetPage: true }
        )
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

      > .dito-button {
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
