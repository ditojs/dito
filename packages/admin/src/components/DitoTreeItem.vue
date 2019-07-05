<template lang="pug">
  .dito-tree-item(
    :id="dataPath"
    :class="classes"
  )
    .dito-tree-header(v-if="label")
      .dito-tree-branch(
        v-if="numEntries"
        @click.stop="opened = !opened"
      )
        .dito-chevron(
          v-if="numEntries"
          :class="{ 'dito-opened': opened }"
        )
        .dito-tree-label(v-html="label")
        .dito-tree-info(v-if="details") {{ details }}
      .dito-tree-leaf(v-else)
        .dito-tree-label(v-html="label")
      .dito-buttons.dito-buttons-small(v-if="hasEditButtons")
        button.dito-button(
          v-if="draggable"
          type="button"
          v-bind="getButtonAttributes(verbs.drag)"
        )
        button.dito-button(
          v-if="editable"
          type="button"
          @click="onEdit"
          v-bind="getButtonAttributes(verbs.edit)"
        )
        button.dito-button(
          v-if="deletable"
          type="button"
          @click="onDelete"
          v-bind="getButtonAttributes(verbs.delete)"
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
      v-bind="childrenDragOptions"
      :list="childrenList"
      @start="onStartDrag"
      @end="onEndDrag"
    )
      dito-tree-item(
        v-for="(item, index) in childrenItems"
        :key="index"
        :schema="children"
        :dataPath="getItemDataPath(children, index)"
        :data="item.data"
        :path="item.path"
        :open="item.open"
        :active="item.active"
        :draggable="childrenDraggable"
        :label="getItemLabel(children, item.data, index)"
        :level="level + 1"
      )
</template>

<style lang="sass">
  // Use precalculated level classes, so that we can add the accumulated indent
  // padding directly instead of having it accumulate in CSS. This way, we can
  // keep the .dito-active area cover the full width:
  @for $i from 1 through 4
    .dito-tree-level-#{$i}
      > .dito-tree-header
        > .dito-tree-branch,
        > .dito-tree-leaf
          padding-left: $chevron-indent * ($i - 1)
  .dito-tree-item
    .dito-tree-branch
      cursor: pointer
    .dito-tree-header
      display: flex
      justify-content: space-between
    .dito-tree-branch,
    .dito-tree-leaf
      flex: auto
      position: relative
      margin: 1px 0
      +user-select(none)
      > *
        display: inline
    .dito-tree-label,
    .dito-tree-info
      white-space: nowrap
    .dito-tree-info
      color: rgba($color-black, .2)
    .dito-buttons
      display: flex
      visibility: hidden
      height: 100%
      margin-left: 1em
      margin: 1px 0 1px 1em
    .dito-tree-header:hover
      > .dito-buttons
        visibility: visible
    // Hide buttons during dragging
    &.dito-dragging
      .dito-tree-header
        > .dito-buttons
          visibility: hidden
    &.dito-active
      > .dito-tree-header
        background: $color-active
        padding: 0 $input-padding-hor
        margin: 0 (-$input-padding-hor)
        > .dito-tree-branch
          > .dito-chevron::before
              color: $color-white
        > * > .dito-tree-label
          color: $color-white
    .dito-properties
      display: block
      margin-left: $chevron-indent
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
import { appendDataPath } from '@/utils/data'
import { getSchemaAccessor } from '@/utils/accessor'
import { getNamedSchemas, hasForms } from '@/utils/schema'

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
    active: { type: Boolean, default: false },
    draggable: { type: Boolean, default: false },
    label: { type: String, default: null },
    level: { type: Number, default: 0 }
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
      return getNamedSchemas(this.schema.properties)
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
      return (
        this.childrenList?.length > 1 &&
        this.getSchemaValue('draggable', {
          type: Boolean,
          default: false,
          schema: this.children
        })
      )
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
          const active = editPath === path
          return {
            data,
            path,
            open,
            active
          }
        }) || []
      }
    },

    details() {
      const { numChildren } = this
      return numChildren && ` ${numChildren} ${
        numChildren === 1 ? 'item' : 'items'}`
    },

    classes() {
      return {
        ...(this.level > 0 && { [`dito-tree-level-${this.level}`]: true }),
        'dito-dragging': this.dragging,
        'dito-active': this.active
      }
    },

    hasEditButtons() {
      return this.draggable || this.editable || this.deletable
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

    deletable: getSchemaAccessor('deletable', {
      type: Boolean,
      default: false
    })
  },

  methods: {
    getDataPath(cell) {
      return appendDataPath(this.dataPath, cell.name)
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
    },

    onChange() {
      this.container.onChange()
    }
  }
})
</script>
