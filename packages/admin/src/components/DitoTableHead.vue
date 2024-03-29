<template lang="pug">
thead.dito-table-head
  tr
    template(
      v-for="column in columns"
    )
      th(
        v-if="shouldRenderSchema(column)"
        :class="getColumnClass(column)"
      )
        RouterLink(
          v-if="column.sortable"
          v-slot="{ navigate }"
          :to="getSortLink(column)"
          custom
        )
          button.dito-button(
            type="button"
            :class="getSortClass(column)"
            @click="navigate"
          )
            .dito-order-arrows
            span {{ getLabel(column) }}
        span(
          v-else
        ) {{ getLabel(column) }}
    th(
      v-if="hasEditButtons"
    )
      //- Empty <span> is needed for styling, see _table.scss
      span
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import { hyphenate } from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('DitoTableHead', {
  props: {
    query: { type: Object, required: true },
    columns: { type: Object, required: true },
    hasEditButtons: { type: Boolean, required: true }
  },

  computed: {
    sort() {
      const order = (this.query.order || '').split(/\s+/)
      return {
        name: order[0],
        order: order[1]
      }
    }
  },

  methods: {
    getColumnClass(column) {
      return `dito-column-${hyphenate(column.name)}`
    },

    getSortClass(column) {
      return this.sort.name === column.name
        ? `dito-selected dito-order-${this.sort.order}`
        : null
    },

    getSortLink(column) {
      // Toggle order if the same column is clicked again.
      const order =
        this.sort.name === column.name && this.sort.order === 'asc'
          ? 'desc'
          : 'asc'
      return this.getQueryLink({
        ...this.query,
        order: `${column.name} ${order}`
      })
    }
  }
})
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
