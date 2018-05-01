<template lang="pug">
  .dito-tree-item(
    :class="{ \
      'dito-dragging': dragging, \
      'dito-editing': editing \
    }"
  )
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
          v-if="editable"
          type="button"
          class="dito-button-edit"
          @click="onEdit"
        )
        button.dito-button(
          v-if="deletable"
          type="button"
          class="dito-button-delete"
          @click="onDelete"
        )
    vue-draggable(
      v-if="children"
      :list="childrenList"
      :options="childrenDragOptions"
      @start="onStartDrag"
      @end="onEndDrag($event, childrenList, children)"
    )
      dito-tree-item(
        v-for="(item, index) in childrenItems"
        v-show="opened"
        :key="index"
        :data="item.data"
        :path="item.path"
        :open="item.open"
        :editing="item.editing"
        :schema="children"
        :draggable="childrenDraggable"
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
    &.dito-editing
      > .dito-tree-title
        background: $color-lightest
        border-radius: $border-radius
</style>

<script>
import VueDraggable from 'vuedraggable'
import DitoComponent from '@/DitoComponent'
import OrderedMixin from '@/mixins/OrderedMixin'
import { isFunction } from '@ditojs/utils'
import { hasForms } from '@/schema'

export default DitoComponent.component('dito-tree-item', {
  mixins: [OrderedMixin],
  inject: ['container'],

  props: {
    data: { type: [Array, Object] },
    path: { type: String, default: '' },
    open: { type: Boolean, default: false },
    editing: { type: Boolean, default: false },
    schema: { type: Object, required: true },
    draggable: { type: Boolean, default: false }
  },

  components: { VueDraggable },

  data() {
    return {
      opened: this.open || this.inEditPath
    }
  },

  methods: {
    onEdit() {
      // All we got to do is push the right edit path to the router, the rest
      // is handled by our routes, allowing reloads as well.
      this.$router.push({
        path: `${this.container.path}${this.path}`,
        // Preserve current query
        query: this.$route.query
      })
    },

    onDelete() {
      // TODO: Implement!
    }
  },

  computed: {
    title() {
      const { itemLabel } = this.schema
      return itemLabel === false
        ? null
        : isFunction(itemLabel)
          ? itemLabel(this.data)
          : this.data?.[itemLabel]
    },

    children() {
      return this.schema.children
    },

    childrenList() {
      const name = this.children?.name
      return name && this.data[name]
    },

    numChildren() {
      return this.childrenList?.length
    },

    childrenDraggable() {
      return !!(
        this.childrenList?.length > 1 &&
        this.getSchemaValue('draggable', true, this.children)
      )
    },

    childrenDragOptions() {
      return this.getDragOptions(this.childrenDraggable)
    },

    childrenItems() {
      const { children } = this
      if (children) {
        const { editPath } = this.container
        const childrenOpen = !this.path && this.open
        // Build a children list with child meta information for the template.
        return this.childrenList?.map((data, index) => {
          const path = children.path && `${this.path}/${children.path}/${index}`
          const open = childrenOpen ||
            // Only count as "in edit path" when it's not the full edit path.
            editPath.startsWith(path) && path.length < editPath.length
          const editing = editPath === path
          return {
            data,
            path,
            open,
            editing
          }
        }) || []
      }
    },

    info() {
      const { numChildren } = this
      return numChildren && ` ${numChildren} ${
        numChildren === 1 ? 'item' : 'items'}`
    },

    creatable() {
      // TODO: Support creatable!
      return hasForms(this.schema) &&
        this.getSchemaValue('creatable', true)
    },

    editable() {
      return hasForms(this.schema) &&
        this.getSchemaValue('editable', true)
    },

    deletable() {
      return this.getSchemaValue('deletable', true)
    },

    hasButtons() {
      return this.draggable || this.editable || this.deletable
    }
  }
})
</script>
