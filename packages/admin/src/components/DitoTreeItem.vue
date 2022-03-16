<template lang="pug">
  .dito-tree-item(
    :id="dataPath"
    :class=`{
      'dito-dragging': dragging,
      'dito-active': active
    }`
    :style="level > 0 && { '--level': level }"
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
        //- Firefox doesn't like <button> here, so use <a> instead:
        a.dito-button(
          v-if="draggable"
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
        v-for="property in properties"
      )
        td
          dito-label(
            v-if="property.label !== false"
            :dataPath="getPropertyDataPath(property)"
            :label="getLabel(property)"
          )
        dito-table-cell(
          :cell="property"
          :schema="property"
          :dataPath="getPropertyDataPath(property)"
          :data="data"
          :meta="nestedMeta"
          :store="store"
          :disabled="disabled"
        )
    vue-draggable(
      v-if="childrenSchema"
      v-show="opened"
      v-bind="getDragOptions(childrenDraggable, true)"
      :list="updateOrder(childrenSchema, childrenList)"
      @start="onStartDrag"
      @end="onEndDrag($event, childrenSchema)"
    )
      dito-tree-item(
        v-for="(item, index) in childrenItems"
        :key="getItemUid(childrenSchema, item.data)"
        :schema="childrenSchema"
        :dataPath="getItemDataPath(childrenSchema, index)"
        :data="item.data"
        :path="item.path"
        :open="item.open"
        :active="item.active"
        :draggable="childrenDraggable"
        :label="getItemLabel(childrenSchema, item.data, { index })"
        :level="level + 1"
      )
      // TODO: Convert dito-tree-item to use dito-label internally, and then
      // pass `asObject: true` in the `getItemLabel()` call above.
</template>

<style lang="sass">
  .dito-tree-item
    --chevron-indent: #{$chevron-indent}
    > .dito-tree-header
      > .dito-tree-branch,
      > .dito-tree-leaf
        // Use `--level` CSS variable to calculated the accumulated indent
        // padding directly instead of having it accumulate in nested CSS.
        // This way, we can keep the .dito-active area cover the full width:
        padding-left: calc(var(--chevron-indent) * (var(--level, 1) - 1))
    .dito-tree-branch
      cursor: pointer
    .dito-tree-header
      display: flex
      justify-content: space-between
    .dito-tree-branch,
    .dito-tree-leaf
      display: flex
      flex: auto
      position: relative
      margin: 1px 0
      +user-select(none)
    .dito-tree-label,
    .dito-tree-info
      white-space: nowrap
    .dito-tree-info
      padding-left: 0.35em
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
import DitoComponent from '../DitoComponent.js'
import OrderedMixin from '../mixins/OrderedMixin.js'
import { appendDataPath } from '../utils/data.js'
import { getSchemaAccessor } from '../utils/accessor.js'
import { getNamedSchemas, hasFormSchema } from '../utils/schema.js'

// @vue/component
export default DitoComponent.component('dito-tree-item', {
  components: { VueDraggable },
  mixins: [OrderedMixin],
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

    // TODO: Should this be named `sourceSchema` instead? Use SourceMixin?
    childrenSchema() {
      return this.schema.children
    },

    childrenList() {
      const name = this.childrenSchema?.name
      return name && this.data[name]
    },

    childrenDraggable() {
      return (
        this.childrenList?.length > 1 &&
        this.getSchemaValue('draggable', {
          type: Boolean,
          default: false,
          schema: this.childrenSchema
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

    childrenItems() {
      const { childrenSchema } = this
      if (childrenSchema) {
        const { editPath } = this.container
        const childrenOpen = !this.path && childrenSchema.open
        // Build a children list with child meta information for the template.
        return this.childrenList?.map((data, index) => {
          const path = (
            childrenSchema.path &&
            `${this.path}/${childrenSchema.path}/${index}`
          )
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
      return numChildren && `${numChildren} ${
        numChildren === 1 ? 'item' : 'items'
      }`
    },

    hasEditButtons() {
      return this.draggable || this.editable || this.deletable
    },

    // TODO: Support creatable!
    // TODO: Add support for creatable, editable and deletable overrides on the
    // associated forms, just like in `TypeList` and `TypeObject`, through
    // `DitoEditButtons`. It would be best to use `DitoEditButtons` here too.
    creatable: getSchemaAccessor('creatable', {
      type: Boolean,
      default: false,
      get(creatable) {
        return creatable && hasFormSchema(this.schema)
      }
    }),

    editable: getSchemaAccessor('editable', {
      type: Boolean,
      default: false,
      get(editable) {
        return editable && hasFormSchema(this.schema)
      }
    }),

    deletable: getSchemaAccessor('deletable', {
      type: Boolean,
      default: false
    })
  },

  methods: {
    getPropertyDataPath(property) {
      return appendDataPath(this.dataPath, property.name)
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
