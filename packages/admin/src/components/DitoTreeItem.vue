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
      v-for="childrenList in childrenLists"
      :key="childrenList.key"
      :list="childrenList.items"
      :options="childrenList.dragOptions"
      @start="onStartDrag"
      @end="onEndDrag($event, childrenList.items, childrenList.schema)"
    )
      dito-tree-item(
        v-for="(child, index) in childrenList.children"
        v-show="opened"
        :key="index"
        :data="child.data"
        :path="child.path"
        :open="child.open"
        :editing="child.editing"
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
    &.dito-editing
      > .dito-tree-title
        background: $color-lightest
        border-radius: $border-radius
</style>

<script>
import VueDraggable from 'vuedraggable'
import DitoComponent from '@/DitoComponent'
import OrderedMixin from '@/mixins/OrderedMixin'
import { isObject, isFunction } from '@ditojs/utils'
import { hasForms } from '@/schema'

export default DitoComponent.component('dito-tree-item', {
  mixins: [OrderedMixin],

  props: {
    data: { type: [Array, Object] },
    path: { type: String, default: '' },
    open: { type: Boolean, default: false },
    editing: { type: Boolean, default: false },
    schema: { type: Object, required: true },
    draggable: { type: Boolean, default: false },
    container: { type: Object, required: true }
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
    },

    isObjectKey(key) {
      // Returns `true` for schema key that can provide objects, so they can be
      // distinguished from nested schema objects.
      return ['form', 'forms', 'draggable'].includes(key)
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

    childrenLists() {
      // Loop through the schema, find all nested schemas, and build a children
      // list for each.
      const lists = []
      for (const [key, schema] of Object.entries(this.schema)) {
        // Identify nested entries that describe sub-trees as schema objects.
        if (isObject(schema) && !this.isObjectKey(key)) {
          const items = this.data[key]
          const draggable = !!(
            items?.length > 1 &&
            this.getSchemaValue('draggable', true, schema)
          )
          const { editPath } = this.container
          const childrenOpen = !this.path && this.open
          // Build a children list with child meta information for the template.
          const children = items?.map((data, index) => {
            const path = `${this.path}/${schema.path}/${index}`
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
          lists.push({
            key,
            schema,
            children,
            items,
            draggable,
            dragOptions: this.getDragOptions(draggable)
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
