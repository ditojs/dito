<template lang="pug">
  .dito-tree-item(:class="{ 'dito-dragging': dragging }")
    template(v-if="title")
      .dito-tree-branch(v-if="numChildren" @click.stop="opened = !opened")
        .dito-tree-chevron(v-if="!root" :class="{ 'dito-opened': opened }")
        .dito-tree-title(v-html="title")
        .dito-tree-info(v-if="info") {{ info }}
      .dito-tree-leaf(v-else)
        .dito-tree-title(v-html="title")
    .dito-buttons.dito-buttons-inline(v-if="hasButtons")
      button.dito-button(
        v-if="schema.draggable"
        type="button"
        class="dito-button-drag"
      )
      // TODO:
      button.dito-button(
        v-if="schema.editable"
        type="button"
        class="dito-button-edit"
      )
      button.dito-button(
        v-if="schema.deletable"
        type="button"
        class="dito-button-delete"
      )
      // router-link.dito-button(
        v-if="schema.editable"
        :to="`${path}${getItemId(item, index)}`" append
        tag="button"
        type="button"
        :class="`dito-button-${verbEdit}`")
      // button.dito-button(
        v-if="schema.deletable"
        type="button"
        @click="deleteItem(item)"
        :class="`dito-button-${verbDelete}`")
    vue-draggable(
      v-for="list in childrenLists"
      :key="list.name"
      :list="list.items"
      :options="list.dragOptions"
      @start="startDrag(list)"
      @end="endDrag(list, $event)"
    )
      dito-tree-item(
        v-show="opened"
        v-for="(child, key) in list.items"
        :key="getTitle(child, list.schema)"
        :data="child"
        :schema="list.schema"
        :open="childrenOpen"
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
    &:hover
      > .dito-buttons
        visibility: visible
    &.dito-dragging
      // Hide buttons during dragging
      .dito-buttons
        visibility: hidden
</style>

<script>
import DitoComponent from '@/DitoComponent'
import { isObject, isFunction } from '@/utils'

export default DitoComponent.component('dito-tree-item', {
  props: {
    data: { type: [Array, Object] },
    schema: { type: Object, required: true },
    root: { type: Boolean, default: false },
    open: { type: Boolean, default: false },
    childrenOpen: { type: Boolean, default: false }
  },

  data() {
    return {
      opened: this.open,
      dragging: false
    }
  },

  methods: {
    getTitle(child) {
      const { itemTitle } = this.schema
      return isFunction(itemTitle) ? itemTitle(child) : child?.[itemTitle]
    },

    startDrag() {
      this.dragging = true
    },

    endDrag(list, event) {
      this.dragging = false
      const orderKey = list.schema?.orderKey
      if (orderKey) {
        // Reorder the chnaged children by their orderKey.
        const start = Math.min(event.oldIndex, event.newIndex)
        const { items } = list
        for (let i = start; i < items.length; i++) {
          items[i][orderKey] = i
        }
      }
    }
  },

  computed: {
    title() {
      return this.getTitle(this.data, this.schema)
    },

    childrenLists() {
      // Loop through the schema, find all nested schemas, and build a children
      // list for each.
      const lists = []
      for (const [name, schema] of Object.entries(this.schema)) {
        if (name !== 'form' && isObject(schema)) {
          lists.push({
            name,
            schema,
            items: this.data[name],
            dragOptions: {
              animation: 150,
              disabled: !schema.draggable,
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
        (count, list) => count + list.items.length,
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
      return schema.editable || schema.deletable || schema.draggable
    }
  }
})
</script>
