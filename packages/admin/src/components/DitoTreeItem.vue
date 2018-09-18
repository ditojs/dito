<template lang="pug">
  .dito-tree-item(
    :id="dataPath"
    :class=`{
      'dito-dragging': dragging,
      'dito-editing': editing
    }`
  )
    .dito-tree-header(v-if="label")
      .dito-tree-branch(v-if="numEntries" @click.stop="opened = !opened")
        .dito-tree-chevron(v-if="numEntries" :class="{ 'dito-opened': opened }")
        .dito-tree-label(v-html="label")
        .dito-tree-info(v-if="details") {{ details }}
      .dito-tree-leaf(v-else)
        .dito-tree-label(v-html="label")
      .dito-buttons.dito-buttons-small(v-if="hasButtons")
        button.dito-button(
          v-if="draggable"
          type="button"
          :class="`dito-button-${verbs.drag}`"
          :title="labelize(verbs.drag)"
        )
        button.dito-button(
          v-if="editable"
          type="button"
          :class="`dito-button-${verbs.edit}`"
          :title="labelize(verbs.edit)"
          @click="onEdit"
        )
        button.dito-button(
          v-if="deletable"
          type="button"
          :class="`dito-button-${verbs.delete}`"
          :title="labelize(verbs.delete)"
          @click="onDelete"
        )
      table.dito-properties(
        v-if="properties"
        v-show="opened"
      )
        tr(
          v-for="cell in properties"
        )
          td
            dito-label(
              v-if="cell.label !== false"
              :dataPath="getDataPath(cell)"
              :text="getLabel(cell)"
            )
          dito-table-cell(
            :key="cell.name"
            :cell="cell"
            :schema="schema"
            :dataPath="getDataPath(cell)"
            :data="data"
            :meta="nestedMeta"
            :store="store"
            :disabled="disabled"
          )
    vue-draggable(
      v-if="children"
      v-show="opened"
      :list="childrenList"
      :options="childrenDragOptions"
      @start="onStartDrag"
      @end="onEndDrag($event, childrenList, children)"
    )
      dito-tree-item(
        v-for="(item, index) in childrenItems"
        :key="index"
        :schema="children"
        :dataPath="getItemDataPath(item, index)"
        :data="item.data"
        :path="item.path"
        :open="item.open"
        :editing="item.editing"
        :draggable="childrenDraggable"
        :label="getItemLabel(children, item.data, index)"
      )
</template>

<style lang="sass">
$tree-indent: 1.2em

.dito
  .dito-tree-item
    .dito-tree-item
      .dito-tree-item
        margin-left: $tree-indent
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
    .dito-tree-header:hover
      > .dito-buttons
        visibility: visible
    // Hide buttons during dragging
    &.dito-dragging
      .dito-tree-header
        > .dito-buttons
          visibility: hidden
    &.dito-editing
      > .dito-tree-header
        background: $color-lightest
        border-radius: $border-radius
    .dito-properties
      margin-left: $tree-indent
      > tr
        vertical-align: baseline
      .dito-label
        margin: 0
        &::after
          content: ': '
</style>

<script>
import VueDraggable from 'vuedraggable'
import DitoComponent from '@/DitoComponent'
import ItemMixin from '@/mixins/ItemMixin'
import OrderedMixin from '@/mixins/OrderedMixin'
import { getSchemaAccessor } from '@/utils/accessor'
import { hasForms } from '@/utils/schema'

// @vue/component
export default DitoComponent.component('dito-tree-item', {
  components: { VueDraggable },
  mixins: [ItemMixin, OrderedMixin],
  inject: ['container'],

  props: {
    schema: { type: Object, required: true },
    dataPath: { type: String, required: true },
    data: { type: [Array, Object], default: null },
    path: { type: String, default: '' },
    open: { type: Boolean, default: false },
    editing: { type: Boolean, default: false },
    draggable: { type: Boolean, default: false },
    label: { type: String, default: null }
  },

  data() {
    return {
      opened: this.open || this.schema.open
    }
  },

  computed: {
    meta() {
      return this.container.meta
    },

    store() {
      return this.container.store
    },

    disabled() {
      return this.container.disabled
    },

    nestedMeta() {
      return {
        ...this.meta,
        schema: this.schema
      }
    },

    properties() {
      return this.getNamedSchemas(this.schema.properties)
    },

    children() {
      // TODO: Should this be named `sourceSchema` instead? Use SourceMixin?
      return this.schema.children
    },

    childrenList() {
      const name = this.children?.name
      return name && this.data[name]
    },

    childrenDraggable() {
      return this.childrenList?.length > 1 &&
        this.getSchemaValue('draggable', {
          type: Boolean,
          default: false,
          schema: this.children
        })
    },

    numChildren() {
      return this.childrenList?.length || 0
    },

    numProperties() {
      return this.properties?.length || 0
    },

    numEntries() {
      return this.numProperties + this.numChildren
    },

    childrenDragOptions() {
      return this.getDragOptions(this.childrenDraggable)
    },

    childrenItems() {
      const { children } = this
      if (children) {
        const { editPath } = this.container
        const childrenOpen = !this.path && children.open
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

    details() {
      const { numChildren } = this
      return numChildren && ` ${numChildren} ${
        numChildren === 1 ? 'item' : 'items'}`
    },

    // TODO: Support creatable!
    creatable: getSchemaAccessor('creatable', {
      type: Boolean,
      default: false,
      get(creatable) {
        return creatable && hasForms(this.schema)
      }
    }),

    editable: getSchemaAccessor('editable', {
      type: Boolean,
      default: false,
      get(editable) {
        return editable && hasForms(this.schema)
      }
    }),

    deletable: getSchemaAccessor('deletable', { type: Boolean }),

    hasButtons() {
      return this.draggable || this.editable || this.deletable
    }
  },

  methods: {
    getDataPath(cell) {
      return `${this.dataPath}/${cell.name}`
    },

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
  }
})
</script>
