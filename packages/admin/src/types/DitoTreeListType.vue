<template lang="pug">
.dito-tree-list(
  ref="element"
  :class=`{
    'dito-tree-list--has-errors': !!errorsElementId,
    'dito-tree-list--disabled': disabled
  }`
)
  DitoScopes(
    v-if="scopes"
    :listQuery="listQuery"
    :scopes="scopes"
    :context="context"
  )
  .dito-tree-list__panel
    //- Objects that are `null` have no tree, as tree items can't create them.
    DitoTreeItem(
      v-if="treeData"
      :schema="treeSchema"
      :dataPath="treeDataPath"
      :data="treeData"
      :path="rootPath"
      :draggable="draggable"
      :open="true"
      :aria-label="labelText || labelize(schema.name)"
      @change-children="changeChildren"
    )
    .dito-tree-list__form-container(
      v-if="isEditingItem"
    )
      DitoRouterView(:routeLevel="routeContext.level + 1")
</template>

<script>
import { computed } from 'vue'
import { labelize } from '@ditojs/utils'
import { defineType } from '../utils/schema/types.ts'
import { sourceTraits } from './traits.ts'
import { fieldProps } from '../composables/useField.ts'
import { useSource } from '../composables/useSource.ts'
import {
  resolveSchemaComponents,
  setupSchemaComponent,
  assertRemovedSchemaKeys
} from '../utils/schema/setup.js'
import { getParentDataPath } from '../utils/data.js'

// @vue/component
const DitoTreeListType = {
  props: fieldProps,

  setup(props) {
    const source = useSource(props)
    const { services, value, isListSource, onChange } = source
    const { routeContext } = services
    return {
      ...source,
      routeContext,
      labelize,

      // The tree renders the forms of the items that it claimed:
      isEditingItem: computed(
        () => routeContext.childClaim?.source === source.sourceContext
      ),

      treeData: computed(() =>
        isListSource.value ? { [props.schema.name]: value.value } : value.value
      ),

      // Remove `name` from `dataPath`, as it is added to `treeData` and
      // `treeSchema`:
      treeDataPath: computed(() =>
        isListSource.value ? getParentDataPath(props.dataPath) : props.dataPath
      ),

      // Tree objects are edited in the form of their root item:
      rootPath: computed(() =>
        source.isObjectSource.value ? source.sourceContext.objectPath : null
      ),

      treeSchema: computed(() =>
        isListSource.value
          ? { children: { name: props.schema.name, ...props.schema } }
          : props.schema
      ),

      // The only writer of the tree, see `DitoTreeItem`:
      changeChildren({ entry, children }) {
        services.dataContext.model.replaceItems(entry, children)
        onChange()
      }
    }
  }
}

const treeTraits = {
  ...sourceTraits,
  component: DitoTreeListType,
  // The forms of their children are routed next to theirs:
  hasEmbeddedForms: true,

  getChildSourceSchemas(schema) {
    return schema.children ? [schema.children] : []
  },

  async setupSchema({ schema, api, name }) {
    assertRemovedSchemaKeys(schema, name, {
      open: `'collapsed'`,
      expanded: `'collapsed: false'`
    })
    const { children } = schema
    if (children) {
      // Change the schema in place, as setup and the data walk are keyed by
      // schema identity:
      children.type = 'tree-list'
    }
    await Promise.all([
      resolveSchemaComponents(schema.properties),
      sourceTraits.setupSchema({ schema, api, name }),
      children && setupSchemaComponent(api, children, children.name)
    ])
  }
}

defineType({ ...treeTraits, type: 'tree-list', sourceType: 'list' })
defineType({ ...treeTraits, type: 'tree-object', sourceType: 'object' })

export default DitoTreeListType
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-tree-list {
  $self: &;

  @extend %field;

  &--has-errors {
    @extend %field-has-errors;
  }

  &--disabled {
    @extend %field-disabled;
  }

  &__panel {
    display: flex;
    justify-content: space-between;

    > .dito-tree-item {
      flex: 1 1 25%;
    }

    > #{$self}__form-container {
      flex: 0 1 75%;
      align-self: stretch;
      background: $content-color-background;
      border-left: $border-style;
      border-top-right-radius: $border-radius - 1;
      border-bottom-right-radius: $border-radius - 1;
      margin: (-$input-padding-ver) (-$input-padding-hor);
      margin-left: $input-padding-hor;
    }
  }
}
</style>
