<template lang="pug">
.dito-tree-item(
  :id="componentPath"
  :class=`{
    'dito-tree-item--dragging': isDragging,
    'dito-tree-item--active': active,
    'dito-tree-item--error': hasErrors
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
    DitoEditButtons.dito-buttons--small.dito-tree-item__buttons(
      v-if="hasEditButtons"
      :round="false"
      :schema="schema"
      :formSchema="getItemFormSchema(schema, data, context)"
      :dataPath="dataPath"
      :data="data"
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
          :context="context"
        )
      DitoTableCell(
        :cell="property"
        :schema="schema"
        :dataPath="dataPath"
        :data="data"
        :store="store"
        :disabled="disabled"
      )
  DitoDraggable(
    v-if="childrenSchema"
    v-show="opened"
    :options="getDraggableOptions(true)"
    :draggable="childrenDraggable"
    :modelValue="childrenList || []"
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
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import DitoEditButtons from './DitoEditButtons.vue'
import { useSortable } from '../composables/useSortable.ts'
import { useSourceItems } from '../composables/useSourceItems.ts'
import { useSchemaContext } from '../composables/useSchemaContext.ts'
import { useSchemaValue } from '../composables/useSchemaValue.ts'
import { useComponentPath } from '../composables/useComponentPath.ts'
import { appendDataPath, getRelativeDataPath } from '../utils/data.js'
import {
  getItemFormSchema,
  getNamedSchemas,
  hasFormSchema
} from '../utils/schema/lookup.js'
import { getItemUid } from '../utils/schema/data.js'
import { getTextFromHtml } from '../utils/html.js'
import { getListWithMovedItem } from '../utils/list.js'
import { confirmAndRemove } from '../utils/dialogs.js'
import { isPathWithin } from '../utils/route.js'

// Items don't write the tree: They emit `changeChildren` for the tree list.
export default {
  name: 'DitoTreeItem',
  components: { DitoEditButtons },
  emits: ['delete', 'move', 'changeChildren'],

  props: {
    schema: { type: Object, required: true },
    dataPath: { type: String, required: true },
    data: { type: [Array, Object], default: null },
    // The path of the form that edits the item, if it has one:
    path: { type: String, default: null },
    open: { type: Boolean, default: false },
    active: { type: Boolean, default: false },
    draggable: { type: Boolean, default: false },
    label: { type: String, default: null },
    level: { type: Number, default: 0 }
  },

  setup(props, { emit }) {
    const currentRoute = useRoute()
    const { context, services } = useSchemaContext(props)
    const { sourceContext } = services
    const { getSchemaValue, getLabel } = useSchemaValue(context)
    // Continue the path of the tree list, whose name the data path of the root
    // item doesn't contain:
    const { componentPath } = useComponentPath(
      () => props.dataPath,
      () => {
        const relativeDataPath = getRelativeDataPath(
          props.dataPath,
          sourceContext.dataPath
        )
        return relativeDataPath
          ? appendDataPath(sourceContext.componentPath, relativeDataPath)
          : sourceContext.componentPath
      }
    )
    const { getItemDataPath, getItemLabel } = useSourceItems({
      services,
      getContext: () => context,
      getSchema: () => props.schema,
      getDataPath: () => props.dataPath
    })
    const opened = ref(props.open || props.schema.collapsed === false)

    // Open the item also when it comes into the edit path later:
    watch(
      () => props.open,
      open => {
        if (open) {
          opened.value = true
        }
      }
    )

    const childrenSchema = computed(() => props.schema.children)
    const childrenList = computed(() => {
      const name = childrenSchema.value?.name
      return name && props.data[name]
    })
    const properties = computed(() => getNamedSchemas(props.schema.properties))
    const numChildren = computed(() => childrenList.value?.length || 0)
    const editable = computed(
      () => (
        getSchemaValue('editable', { type: Boolean, default: false }) &&
        hasFormSchema(props.schema)
      )
    )
    const deletable = computed(() =>
      getSchemaValue('deletable', { type: Boolean, default: false })
    )

    const changeChildren = children => {
      emit('changeChildren', {
        // The list entry for the change API of the data model:
        entry: {
          schema: childrenSchema.value,
          list: childrenList.value,
          dataPath: getItemDataPath(childrenSchema.value)
        },
        children
      })
    }

    return {
      getItemUid,
      getItemFormSchema,
      getItemDataPath,
      getItemLabel,
      context,
      componentPath,
      ...useSortable(),
      getLabel,
      opened,
      properties,
      childrenSchema,
      childrenList,
      editable,
      deletable,
      changeChildren,
      store: computed(() => sourceContext.store),
      disabled: computed(() => sourceContext.isDisabled),
      hasErrors: computed(() =>
        services.dataContext.model.hasErrorsWithin(props.data)
      ),
      numEntries: computed(
        () => (properties.value?.length || 0) + numChildren.value
      ),
      ariaLabel: computed(() =>
        props.label ? getTextFromHtml(props.label) : null
      ),
      details: computed(() => {
        const count = numChildren.value
        return count && `${count} ${count === 1 ? 'item' : 'items'}`
      }),
      hasEditButtons: computed(
        () => props.draggable || editable.value || deletable.value
      ),
      editPath: computed(() => (editable.value ? props.path : null)),

      childrenDraggable: computed(
        () => (
          childrenList.value?.length > 1 &&
          getSchemaValue('draggable', {
            type: Boolean,
            default: false,
            schema: childrenSchema.value
          })
        )
      ),

      childrenItems: computed(() => {
        const schema = childrenSchema.value
        const list = childrenList.value
        if (schema && list) {
          const routePath = currentRoute.path
          // Reflect the route in `open`, to reopen items closed by the user:
          return list.map((data, index) => {
            const path = services.routeContext?.getFormPath(
              getItemDataPath(schema, index)
            )
            const active = !!path && routePath === path
            const open = !!path && !active && isPathWithin(routePath, path)
            return { data, path, open, active }
          })
        }
        return []
      }),

      moveChild(child, delta) {
        const children = getListWithMovedItem(childrenList.value, child, delta)
        if (children) {
          changeChildren(children)
        }
      },

      // The removal is transient, as the tree is part of its form's data:
      async deleteChild(child) {
        await confirmAndRemove(services, {
          label: getItemLabel(childrenSchema.value, child, {
            index: childrenList.value.indexOf(child),
            extended: true
          }),
          isTransient: true,
          remove: () => {
            // The children may have changed while the dialog was open:
            const list = childrenList.value
            const children = list.filter(it => it !== child)
            if (children.length === list.length) {
              return false
            }
            changeChildren(children)
          }
        })
      }
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-tree-item {
  $self: &;

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

  &__buttons {
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
    > #{$self}__buttons {
      opacity: 1;
    }
  }

  // Hide buttons during dragging
  &--dragging {
    .dito-tree-header {
      > #{$self}__buttons {
        visibility: hidden;
      }
    }
  }

  &--error {
    > .dito-tree-header {
      box-shadow: inset $error-bar-width 0 $color-error;
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
