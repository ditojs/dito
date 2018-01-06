<template lang="pug">
  .dito-tree-item(:class="{ 'dito-dragging': dragging }")
    .dito-tree-title(v-if="title")
      .dito-tree-branch(v-if="numChildren" @click.stop="opened = !opened")
        .dito-tree-chevron(v-if="path" :class="{ 'dito-opened': opened }")
        .dito-tree-name(v-html="title")
        .dito-tree-info(v-if="info") {{ info }}
      .dito-tree-leaf(v-else)
        .dito-tree-name(v-html="title")
      .dito-buttons.dito-buttons-inline(v-if="hasButtons")
        button.dito-button(
          v-if="draggable"
          type="button"
          class="dito-button-drag"
        )
        button.dito-button(
          v-if="schema.editable"
          type="button"
          class="dito-button-edit"
          @click="onEdit"
        )
        button.dito-button(
          v-if="schema.deletable"
          type="button"
          class="dito-button-delete"
          @click="onDelete"
        )
    vue-draggable(
      v-for="childrenList in childrenLists"
      :key="childrenList.name"
      :list="childrenList.items"
      :options="childrenList.dragOptions"
      @start="onStartDrag"
      @end="onEndDrag(childrenList, $event)"
    )
      dito-tree-item(
        v-for="(child, index) in childrenList.children"
        v-show="opened"
        :key="index"
        :data="child.data"
        :path="child.path"
        :open="child.open"
        :schema="childrenList.schema"
        :draggable="childrenList.draggable"
        :container="container"
      )
</template>

<style lang="sass">
.dito
  .dito-tree-item
    .dito-tree-item
      .dito-tree-item
        margin-left: 1.2em
    .dito-tree-branch
      cursor: pointer
    .dito-tree-branch,
    .dito-tree-leaf
      display: inline-block
      position: relative
      margin: 1px 0
      +user-select(none)
      > *
        display: inline
    .dito-tree-info
      color: $color-light
    .dito-tree-chevron
      padding-left: 14px
      &::before
        color: $color-grey
        content: '\25b6'
        position: absolute
        left: 0
        transition: transform .1s ease
      &.dito-opened::before
        left: -0.1em
        transform: rotate(90deg)
    .dito-buttons
      visibility: hidden
      float: right
      margin-left: 1em
      margin-bottom: -1em // so float don't push each other away
    .dito-tree-title:hover
      > .dito-buttons
        visibility: visible
    // Hide buttons during dragging
    &.dito-dragging
      .dito-tree-title
        > .dito-buttons
          visibility: hidden
</style>

<script>
import DitoComponent from '@/DitoComponent'
import { isObject, isFunction } from '@/utils'

export default DitoComponent.component('dito-tree-item', {
  props: {
    data: { type: [Array, Object] },
    path: { type: String, default: '' },
    open: { type: Boolean, default: false },
    schema: { type: Object, required: true },
    draggable: { type: Boolean, default: false },
    container: { type: Object, required: true }
  },

  data() {
    return {
      opened: this.open || this.inEditPath,
      dragging: false
    }
  },

  methods: {
    onEdit() {
      this.$router.push({
        path: `${this.container.path}${this.path}`,
        // Preserve current query
        query: this.$route.query
      })
    },

    onDelete() {
      // TODO: Implement!
    },

    onStartDrag() {
      this.dragging = true
    },

    onEndDrag(childrenList, event) {
      this.dragging = false
      // eslint-disable-next-line
      const orderKey = childrenList.schema?.orderKey
      if (orderKey) {
        // Reorder the chnaged children by their orderKey.
        const start = Math.min(event.oldIndex, event.newIndex)
        const { items } = childrenList
        for (let i = start; i < items.length; i++) {
          items[i][orderKey] = i
        }
      }
    }
  },

  computed: {
    title() {
      const { itemLabel } = this.schema
      return isFunction(itemLabel)
        ? itemLabel(this.data)
        : this.data?.[itemLabel]
    },

    childrenLists() {
      // Loop through the schema, find all nested schemas, and build a children
      // list for each.
      const lists = []
      for (const [name, schema] of Object.entries(this.schema)) {
        if (name !== 'form' && isObject(schema)) {
          const items = this.data[name]
          const draggable = schema.draggable && items?.length > 1
          const { editPath } = this.container
          const childrenOpen = !this.path && this.open
          // Build a children list with child meta information for the template.
          const children = items?.map((data, index) => {
            const path = `${this.path}/${schema.path}/${index}`
            const open = childrenOpen ||
              // Only count as "in edit path" when it's not the full edit path.
              editPath.startsWith(path) && path.length < editPath.length
            return {
              data,
              path,
              open
            }
          }) || []
          lists.push({
            name,
            schema,
            children,
            items,
            draggable,
            dragOptions: {
              animation: 150,
              disabled: !draggable,
              handle: '.dito-button-drag',
              ghostClass: 'dito-drag-ghost'
            }
          })
        }
      }
      return lists
    },

    numChildren() {
      return this.childrenLists.reduce(
        (count, childrenList) => count + childrenList.items.length,
        0
      )
    },

    info() {
      const { numChildren } = this
      return numChildren && ` ${numChildren} ${
        numChildren === 1 ? 'item' : 'items'}`
    },

    hasButtons() {
      const { schema } = this
      return this.draggable || schema.editable || schema.deletable
    }
  }
})
</script>
