<template lang="pug">
.dito-tree-item(
  :id="dataPath"
  :class=`{
    'dito-dragging': isDragging,
    'dito-active': active
  }`
  :style="level > 0 && { '--level': level }"
  :data-path="path"
)
  .dito-tree-header(
    v-if="label"
  )
    .dito-tree-branch(
      v-if="numEntries"
      @click.stop="opened = !opened"
    )
      .dito-chevron(
        v-if="numEntries"
        :class="{ 'dito-open': opened }"
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
    .dito-buttons.dito-buttons-small(
      v-if="hasEditButtons"
    )
      //- Firefox doesn't like <button> here, so use <a> instead:
      a.dito-button(
        v-if="draggable"
        v-bind="getButtonAttributes(verbs.drag)"
      )
      button.dito-button(
        v-if="editable"
        type="button"
        v-bind="getButtonAttributes(verbs.edit)"
        @click="onEdit"
      )
      button.dito-button(
        v-if="deletable"
        type="button"
        v-bind="getButtonAttributes(verbs.delete)"
        @click="onDelete"
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
          :dataPath="getPropertyDataPath(property)"
          :label="getLabel(property)"
        )
      DitoTableCell(
        :cell="property"
        :schema="property"
        :dataPath="getPropertyDataPath(property)"
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
    :modelValue="updateOrder(childrenSchema, childrenList)"
    @update:modelValue="value => (childrenList = value)"
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
    )
    //- TODO: Convert dito-tree-item to use dito-label internally, and then
    //- pass `asObject: true` in the `getItemLabel()` call above.
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import ItemMixin from '../mixins/ItemMixin'
import SortableMixin from '../mixins/SortableMixin.js'
import { appendDataPath } from '../utils/data.js'
import { getSchemaAccessor } from '../utils/accessor.js'
import { getNamedSchemas, hasFormSchema } from '../utils/schema.js'

// @vue/component
export default DitoComponent.component('DitoTreeItem', {
  mixins: [ItemMixin, SortableMixin],
  emits: ['update:data'],
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

    childrenList: {
      get() {
        const name = this.childrenSchema?.name
        return name && this.data[name]
      },

      set(value) {
        const name = this.childrenSchema?.name
        if (name) {
          this.updateOrder(this.childrenSchema, value)
          // eslint-disable-next-line vue/no-mutating-props
          this.data[name] = value
          this.$emit('update:data', value)
        }
      }
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
        const { editPath } = this.container
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
            editPath.startsWith(path) && path.length < editPath.length
          )
          const active = editPath === path
          return { data, path, open, active }
        })
      }
      return []
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

    editPath(path) {
      // All we got to do is push the right edit path to the router, the rest
      // is handled by our routes, allowing reloads as well.
      this.$router.push({
        path: `${this.container.path}${path}`,
        // Preserve current query
        query: this.$route.query
      })
    },

    onEdit() {
      this.editPath(this.path)
    },

    onDelete() {
      // TODO: Implement!
    },

    onChange() {
      this.container.onChange()
    },

    // @override
    onEndDrag(event) {
      SortableMixin.methods.onEndDrag.call(this, event)
      const { item } = event
      // Preserve active state of edited sub-items, by editing their new path.
      if (item.classList.contains('dito-active')) {
        this.$nextTick(() => {
          this.editPath(event.item.dataset.path)
        })
      }
    }
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-tree-item {
  --chevron-indent: #{$chevron-indent};

  > .dito-tree-header {
    > .dito-tree-branch,
    > .dito-tree-leaf {
      // Use `--level` CSS variable to calculated the accumulated indent
      // padding directly instead of having it accumulate in nested CSS.
      // This way, we can keep the .dito-active area cover the full width:
      padding-left: calc(var(--chevron-indent) * (var(--level, 1) - 1));
    }
  }

  .dito-tree-branch {
    cursor: pointer;
  }

  .dito-tree-header {
    display: flex;
    justify-content: space-between;
  }

  .dito-tree-branch,
  .dito-tree-leaf {
    display: flex;
    flex: auto;
    position: relative;
    margin: 1px 0;
    @include user-select(none);
  }

  .dito-tree-label,
  .dito-tree-info {
    white-space: nowrap;
  }

  .dito-tree-info {
    padding-left: 0.35em;
    color: rgba($color-black, 0.2);
  }

  .dito-buttons {
    display: flex;
    visibility: hidden;
    height: 100%;
    margin: 1px 0 1px 1em;
  }

  .dito-tree-header:hover {
    > .dito-buttons {
      visibility: visible;
    } // Hide buttons during dragging
  }

  &.dito-dragging {
    .dito-tree-header {
      > .dito-buttons {
        visibility: hidden;
      }
    }
  }

  &.dito-active {
    > .dito-tree-header {
      background: $color-active;
      padding: 0 $input-padding-hor;
      margin: 0 (-$input-padding-hor);

      > .dito-tree-branch {
        > .dito-chevron::before {
          color: $color-white;
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
