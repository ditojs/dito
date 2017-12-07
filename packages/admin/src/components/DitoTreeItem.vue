<template lang="pug">
  .dito-tree-item(:class="{ 'dito-dragging': dragging }")
    template(v-if="title")
      .dito-tree-branch(v-if="children" @click.stop="opened = !opened")
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
      v-if="children"
      :list="children"
      :options="dragOptions"
      @start="startDrag"
      @end="endDrag"
    )
      dito-tree-item(
        v-show="opened"
        v-for="(child, key) in children"
        :key="getTitle(child, schema.children)"
        :data="child"
        :schema="schema.children"
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
import { isFunction } from '@/utils'

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
    getTitle(item, schema) {
      const { title } = schema
      return isFunction(title) ? title(item) : item?.[title]
    },

    startDrag() {
      this.dragging = true
    },

    endDrag(event) {
      this.dragging = false
      const { orderKey } = this.schema.children
      if (orderKey) {
        // Reorder the chnaged children by their orderKey.
        const start = Math.min(event.oldIndex, event.newIndex)
        const { children } = this
        for (let i = start; i < children.length; i++) {
          children[i][orderKey] = i
        }
      }
    }
  },

  computed: {
    title() {
      return this.getTitle(this.data, this.schema)
    },

    children() {
      const { children } = this.schema
      if (children) {
        const { items } = children
        return items
          ? isFunction(items) ? items(this.data) : items
          : this.data
      }
    },

    info() {
      const { children, object } = this
      const count = children?.length ||
        object && Object.keys(object).length
      const suffix = children
        ? count === 1 ? 'item' : 'items'
        : count === 1 ? 'property' : 'properties'
      return count && ` ${count} ${suffix}`
    },

    dragOptions() {
      return {
        animation: 150,
        disabled: !this.schema.children.draggable,
        handle: '.dito-button-drag',
        ghostClass: 'dito-drag-ghost'
      }
    },

    hasButtons() {
      const { schema } = this
      return schema.editable || schema.deletable || schema.draggable
    }
  }
})
</script>
