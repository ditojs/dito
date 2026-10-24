<template lang="pug">
//- The root item is the tree itself, without a label:
.dito-tree-item(
  :id="componentPath"
  :role="level > 0 ? 'treeitem' : 'tree'"
  :class=`{
    'dito-tree-item--active': active,
    'dito-tree-item--error': hasErrors
  }`
  :style="level > 0 && { '--level': level }"
)
  .dito-tree-item__header(
    v-if="label"
  )
    .dito-tree-item__branch(
      v-if="numEntries"
      role="button"
      tabindex="0"
      :aria-label="ariaLabel"
      :aria-expanded="opened"
      @click.stop="toggle"
      @keydown.enter.space.prevent="toggle"
    )
      //- The chevron and the text, which the focus ring encloses:
      .dito-tree-item__branch-content
        .dito-chevron(:class="{ 'dito-chevron--open': opened }")
        DitoLabel.dito-tree-item__label(
          :label="label"
          :context="context"
        )
        .dito-tree-item__info(
          v-if="info"
        ) {{ info }}
    .dito-tree-item__leaf(
      v-else
    )
      DitoLabel.dito-tree-item__label(
        :label="label"
        :context="context"
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
  table.dito-tree-item__details(
    v-if="details.length > 0"
    v-show="opened"
  )
    tr(
      v-for="detail in details"
    )
      td
        DitoLabel(
          v-if="detail.label !== false"
          :label="getLabel(detail)"
          :context="context"
        )
      DitoTableCell(
        :cell="detail"
        :schema="schema"
        :dataPath="dataPath"
        :data="data"
        :store="store"
        :disabled="disabled"
      )
  //- Screen readers count the groups around an item for its level:
  DitoDraggable(
    v-if="childrenSchema"
    v-show="opened"
    :role="level > 0 ? 'group' : null"
    :options="getDraggableOptions(true)"
    :draggable="childrenDraggable"
    :modelValue="childrenList || []"
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
      :label=`getItemLabel(childrenSchema, item.data, {
        index,
        asObject: true
      })`
      :level="level + 1"
      @delete="deleteChild(item.data)"
      @move="delta => moveItem(index, delta)"
      @change="$emit('change')"
    )
</template>

<script>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import DitoEditButtons from './DitoEditButtons.vue'
import { useSortable } from '../composables/useSortable.ts'
import { useSourceItems } from '../composables/useSourceItems.ts'
import { useSchemaContext } from '../composables/useSchemaContext.ts'
import { useSchemaEvents } from '../composables/useSchemaEvents.ts'
import { useSchemaValue } from '../composables/useSchemaValue.ts'
import { useComponentPath } from '../composables/useComponentPath.ts'
import { appendDataPath, getRelativeDataPath } from '../utils/data.js'
import {
  getItemFormSchema,
  getNamedSchemas,
  hasFormSchema
} from '../utils/schema/lookup.js'
import { getItemUid } from '../utils/schema/data.js'
import { getText } from '../utils/html.js'
import { confirmAndRemove } from '../utils/dialogs.js'
import { isPathWithin } from '../utils/route.js'

// Items report the changes of their children to the tree list as `change`.
export default {
  components: { DitoEditButtons },
  emits: ['delete', 'move', 'change'],

  props: {
    schema: { type: Object, required: true },
    dataPath: { type: String, required: true },
    data: { type: [Array, Object], default: null },
    // The path of the form that edits the item, if it has one:
    path: { type: String, default: null },
    open: { type: Boolean, default: false },
    active: { type: Boolean, default: false },
    draggable: { type: Boolean, default: false },
    label: { type: Object, default: null },
    level: { type: Number, default: 0 }
  },

  setup(props, { emit }) {
    const currentRoute = useRoute()
    const { context, createContext, services } = useSchemaContext(props)
    const { emitEvent } = useSchemaEvents(() => props.schema, {
      services,
      createContext
    })
    const { sourceContext } = services
    const { getSchemaValue, getLabel, shouldRenderSchema } =
      useSchemaValue(context)
    // Continue the path of the tree list, whose name the data path of the root
    // item doesn't contain:
    const getComponentPath = dataPath => {
      const relativeDataPath = getRelativeDataPath(
        dataPath,
        sourceContext.dataPath
      )
      return relativeDataPath
        ? appendDataPath(sourceContext.componentPath, relativeDataPath)
        : sourceContext.componentPath
    }
    const { componentPath } = useComponentPath(
      () => props.dataPath,
      () => getComponentPath(props.dataPath)
    )
    const { getItemDataPath, getItemLabel } = useSourceItems({
      services,
      getContext: () => context,
      getSchema: () => props.schema,
      getDataPath: () => props.dataPath
    })
    const opened = ref(
      props.open ||
      !getSchemaValue('collapsed', { type: Boolean, default: true })
    )

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
    const details = computed(() =>
      Object.values(getNamedSchemas(props.schema.details) || {}).filter(
        shouldRenderSchema
      )
    )
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

    // The list entry for the change API of the data model:
    const childrenEntry = computed(() => ({
      schema: childrenSchema.value,
      list: childrenList.value,
      dataPath: getItemDataPath(childrenSchema.value)
    }))
    const onChange = () => emit('change')

    return {
      getItemUid,
      getItemFormSchema,
      getItemDataPath,
      getItemLabel,
      context,
      componentPath,
      ...useSortable({ getListEntry: () => childrenEntry.value, onChange }),
      getLabel,
      opened,
      details,
      childrenSchema,
      childrenList,
      editable,
      deletable,

      toggle() {
        opened.value = !opened.value
        emitEvent('toggle', { context: { collapsed: !opened.value } })
      },

      store: computed(() => sourceContext.store),
      disabled: computed(() => sourceContext.isDisabled),
      hasErrors: computed(() =>
        services.dataContext.model.errors.hasWithin(props.data)
      ),
      numEntries: computed(() => details.value.length + numChildren.value),
      ariaLabel: computed(() => getText(props.label)),
      info: computed(() => {
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
              getComponentPath(getItemDataPath(schema, index))
            )
            const active = !!path && routePath === path
            const open = !!path && !active && isPathWithin(routePath, path)
            return { data, path, open, active }
          })
        }
        return []
      }),

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
            const index = childrenList.value.indexOf(child)
            if (index >= 0) {
              services.dataContext.model.remove(childrenEntry.value, index)
              onChange()
            } else {
              return false
            }
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

  > #{$self}__header {
    // Extend header into item padding so active background reaches the edge:
    margin: 0 (-$input-padding-hor);
    padding: 0 $input-padding-hor;

    > #{$self}__branch,
    > #{$self}__leaf {
      // Use `--level` CSS variable to calculated the accumulated indent
      // padding directly instead of having it accumulate in nested CSS.
      // This way, we can keep the &--active area cover the full width:
      padding-left: calc(var(--chevron-indent) * (var(--level, 1) - 1));
    }
  }

  #{$self}__branch {
    // Make room for the focus ring of the content, without moving it:
    margin-left: -$focus-ring-padding;
    cursor: pointer;

    &:focus-visible {
      outline: none;

      > #{$self}__branch-content {
        @include focus-ring-line;
      }
    }
  }

  // The whole branch toggles, but the focus ring only encloses its content,
  // padded for it:
  #{$self}__branch-content {
    display: flex;
    position: relative;
    min-width: 0;
    padding: 0 $focus-ring-padding;
  }

  #{$self}__header {
    display: flex;
    justify-content: space-between;
  }

  #{$self}__branch,
  #{$self}__leaf {
    display: flex;
    flex: auto;
    overflow: hidden;
    min-width: 0;
    // High enough for the focus ring of branches, which `overflow` would cut:
    min-height: $focus-ring-height;
    position: relative;
    margin-top: 1px;
    margin-bottom: 1px;
    @include user-select(none);
  }

  #{$self}__label {
    // Size the label like a line of text, not like a field label:
    flex: 0 1 auto;
    align-items: baseline;
    min-height: 0;
    margin: 0;

    label {
      font-weight: inherit;
      line-height: inherit;
    }
  }

  #{$self}__info {
    white-space: nowrap;
    padding-left: 0.35em;
    color: rgba($color-black, 0.2);
  }

  &__buttons {
    flex: none;
    display: flex;
    // Transparent rather than hidden, so the buttons can be focused with the
    // keyboard, which shows them, see below.
    opacity: 0;
    height: 100%;
    margin: 1px;
    margin-right: 0;
  }

  #{$self}__header:hover,
  #{$self}__header:focus-within {
    > #{$self}__buttons {
      opacity: 1;
    }
  }

  // Hide buttons during dragging
  &:has(> .dito-draggable--dragging) {
    #{$self}__header {
      > #{$self}__buttons {
        visibility: hidden;
      }
    }
  }

  &--error {
    > #{$self}__header {
      box-shadow: inset $error-bar-width 0 $color-error;
    }
  }

  &--active {
    > #{$self}__header {
      background: $color-active;

      > #{$self}__branch {
        .dito-chevron::before {
          color: $color-white;
        }

        &:focus-visible > #{$self}__branch-content {
          @include focus-ring-line($color-white);
        }
      }

      #{$self}__label {
        color: $color-white;
      }

      #{$self}__info {
        color: rgba($color-white, 0.6);
      }
    }
  }

  #{$self}__details {
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
