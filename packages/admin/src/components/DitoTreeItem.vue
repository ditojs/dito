<template lang="pug">
.dito-tree-item(
  :id="componentPath"
  :class=`{
    'dito-tree-item--dragging': isDragging,
    'dito-tree-item--active': active
  }`
  :style="level > 0 && { '--level': level }"
)
  .dito-tree-header(
    v-if="label"
  )
    .dito-tree-branch(
      v-if="numEntries"
      role="button"
      tabindex="0"
      :aria-label="ariaLabel"
      :aria-expanded="opened"
      @click.stop="opened = !opened"
      @keydown.enter.space.prevent="opened = !opened"
    )
      .dito-chevron(
        v-if="numEntries"
        :class="{ 'dito-chevron--open': opened }"
      )
      .dito-tree-label(
        v-html="label"
      )
      .dito-tree-info(
        v-if="details"
      ) {{ details }}
    .dito-tree-leaf(
      v-else
    )
      .dito-tree-label(
        v-html="label"
      )
    DitoEditButtons.dito-buttons--small(
      v-if="hasEditButtons"
      :round="false"
      :schema="schema"
      :formSchema="getItemFormSchema(schema, data, context)"
      :dataPath="dataPath"
      :data="data"
      :meta="nestedMeta"
      :store="store"
      :disabled="disabled"
      :draggable="draggable"
      :editable="editable"
      :deletable="deletable"
      :editPath="editPath"
      :editQuery="$route.query"
      @delete="$emit('delete')"
      @move="delta => $emit('move', delta)"
    )
  table.dito-properties(
    v-if="properties"
    v-show="opened"
  )
    tr(
      v-for="property in properties"
    )
      td
        DitoLabel(
          v-if="property.label !== false"
          :label="getLabel(property)"
        )
      DitoTableCell(
        :cell="property"
        :schema="schema"
        :dataPath="dataPath"
        :data="data"
        :meta="nestedMeta"
        :store="store"
        :disabled="disabled"
      )
  DitoDraggable(
    v-if="childrenSchema"
    v-show="opened"
    :options="getDraggableOptions(true)"
    :draggable="childrenDraggable"
    :modelValue="childrenList"
    @update:modelValue="changeChildren"
  )
    DitoTreeItem(
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
      @delete="deleteChild(item.data)"
      @move="delta => moveChild(item.data, delta)"
      @change-children="change => $emit('changeChildren', change)"
    )
    //- TODO: Convert dito-tree-item to use dito-label internally, and then
    //- pass `asObject: true` in the `getItemLabel()` call above.
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import DitoEditButtons from './DitoEditButtons.vue'
import ItemMixin from '../mixins/ItemMixin'
import SortableMixin from '../mixins/SortableMixin.js'
import { appendDataPath, getRelativeDataPath } from '../utils/data.js'
import { getSchemaAccessor } from '../utils/accessor.js'
import { getNamedSchemas, hasFormSchema } from '../utils/schema/lookup.js'
import { getTextFromHtml } from '../utils/html.js'
import { getListWithMovedItem } from '../utils/list.js'
import { confirmAndRemove } from '../utils/dialogs.js'
import { isPathWithin } from '../utils/route.js'

// Renders an item of a tree list or tree object, see `DitoTypeTreeList`, which
// is the item's `sourceComponent`. Items don't write the tree: They emit the
// changed children with `changeChildren`, which the tree list applies.
// @vue/component
export default DitoComponent.component('DitoTreeItem', {
  mixins: [ItemMixin, SortableMixin],
  components: { DitoEditButtons },
  emits: ['delete', 'move', 'changeChildren'],

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
    componentPath() {
      // Continue the path of the tree list with the item indices and children
      // names of the data path. The root item's data path doesn't contain the
      // list's name, see `DitoTypeTreeList.treeDataPath`.
      const { componentPath, dataPath } = this.sourceComponent
      const relativeDataPath = getRelativeDataPath(this.dataPath, dataPath)
      return relativeDataPath
        ? appendDataPath(componentPath, relativeDataPath)
        : componentPath
    },

    meta() {
      return this.sourceComponent.meta
    },

    store() {
      return this.sourceComponent.store
    },

    disabled() {
      return this.sourceComponent.disabled
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
      const { childrenSchema, childrenList } = this
      if (childrenSchema && childrenList) {
        const { editPath } = this.sourceComponent
        const childrenOpen = !this.path && childrenSchema.open
        // Build a children list with child meta information for the template.
        return childrenList.map((data, index) => {
          const path = (
            childrenSchema.path &&
            `${this.path}/${childrenSchema.path}/${index}`
          )
          const open = (
            childrenOpen ||
            // Only count as "in edit path" when it's not the full edit path.
            !!path && editPath !== path && isPathWithin(editPath, path)
          )
          const active = editPath === path
          return { data, path, open, active }
        })
      }
      return []
    },

    ariaLabel() {
      return this.label ? getTextFromHtml(this.label) : null
    },

    details() {
      const { numChildren } = this
      return (
        numChildren &&
        `${numChildren} ${
          numChildren === 1 ? 'item' : 'items'
        }`
      )
    },

    hasEditButtons() {
      return this.draggable || this.editable || this.deletable
    },

    editPath() {
      // The edit routes of the items are handled by the routes of the tree
      // list, allowing reloads as well, see `DitoTypeTreeList.processSchema()`.
      return this.editable && this.path
        ? `${this.sourceComponent.path}${this.path}`
        : null
    },

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

  watch: {
    open(open) {
      // Open the item also when it comes into the edit path later, e.g. when
      // navigating to the form of one of its children.
      if (open) {
        this.opened = true
      }
    }
  },

  methods: {
    changeChildren(children) {
      this.$emit('changeChildren', {
        data: this.data,
        childrenSchema: this.childrenSchema,
        path: this.path,
        children
      })
    },

    // Moves the child by `delta` positions, see `DitoDragHandle`.
    moveChild(child, delta) {
      const children = getListWithMovedItem(this.childrenList, child, delta)
      if (children) {
        this.changeChildren(children)
      }
    },

    // Removes the child after confirming it, like inlined lists do. The removal
    // is transient, as the tree is part of its form's data.
    async deleteChild(child) {
      await confirmAndRemove(this, {
        label: this.getItemLabel(this.childrenSchema, child, {
          index: this.childrenList.indexOf(child),
          extended: true
        }),
        isTransient: true,
        remove: () => {
          // Look up the child by identity once confirmed, as the children may
          // have changed while the dialog was open.
          const children = this.childrenList.filter(it => it !== child)
          if (children.length === this.childrenList.length) {
            return false
          }
          this.changeChildren(children)
        }
      })
    },

    // @override
    onEndDrag() {
      // The tree list applies the reordered children and notifies of the
      // change, see `DitoTypeTreeList.changeChildren()`.
      this.isDragging = false
    }
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-tree-item {
  --chevron-indent: #{$chevron-indent};

  overflow: hidden;
  padding: 0 $input-padding-hor;
  margin: 0 (-$input-padding-hor);

  > .dito-tree-header {
    // Extend header into item padding so active background reaches the edge:
    margin: 0 (-$input-padding-hor);
    padding: 0 $input-padding-hor;

    > .dito-tree-branch,
    > .dito-tree-leaf {
      // Use `--level` CSS variable to calculated the accumulated indent
      // padding directly instead of having it accumulate in nested CSS.
      // This way, we can keep the &--active area cover the full width:
      padding-left: calc(var(--chevron-indent) * (var(--level, 1) - 1));
    }
  }

  .dito-tree-branch {
    cursor: pointer;
    border-radius: $border-radius;

    &:focus-visible {
      @include focus-ring;
    }
  }

  .dito-tree-header {
    display: flex;
    justify-content: space-between;
  }

  .dito-tree-branch,
  .dito-tree-leaf {
    display: flex;
    flex: auto;
    overflow: hidden;
    min-width: 0;
    position: relative;
    margin: 1px 0;
    @include user-select(none);
  }

  .dito-tree-label {
    display: flex;
    align-items: baseline;
    gap: 0.25em;
    min-width: 0;
    white-space: nowrap;

    > :first-child {
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .dito-tree-info {
    white-space: nowrap;
  }

  .dito-tree-info {
    padding-left: 0.35em;
    color: rgba($color-black, 0.2);
  }

  // TODO: BEM: Style an element class of this block, e.g. `&__buttons`.
  .dito-buttons {
    // Leave the width to the branch, so its focus ring spans the row:
    flex: none;
    display: flex;
    // Transparent rather than hidden, so the buttons can be focused with the
    // keyboard, which shows them, see below.
    opacity: 0;
    height: 100%;
    margin: 1px;
    margin-right: 0;
  }

  .dito-tree-header:hover,
  .dito-tree-header:focus-within {
    > .dito-buttons {
      opacity: 1;
    }
  }

  // Hide buttons during dragging
  &--dragging {
    .dito-tree-header {
      > .dito-buttons {
        visibility: hidden;
      }
    }
  }

  &--active {
    > .dito-tree-header {
      background: $color-active;

      > .dito-tree-branch {
        > .dito-chevron::before {
          color: $color-white;
        }

        &:focus-visible {
          @include focus-ring($color-white);
        }
      }

      > * > .dito-tree-label {
        color: $color-white;
      }
    }
  }

  .dito-properties {
    display: block;
    margin-left: $chevron-indent;

    > tr {
      vertical-align: baseline;
    }

    .dito-label {
      margin: 0;

      &::after {
        content: ': ';
      }
    }
  }
}
</style>
