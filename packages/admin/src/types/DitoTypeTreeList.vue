<template lang="pug">
.dito-tree-list
  DitoScopes(
    v-if="scopes"
    :listQuery="listQuery"
    :scopes="scopes"
    :context="context"
  )
  .dito-tree-panel
    //- Objects that are `null` have no tree, as tree items can't create them.
    DitoTreeItem(
      v-if="treeData"
      :schema="treeSchema"
      :dataPath="treeDataPath"
      :data="treeData"
      :path="rootPath"
      :draggable="draggable"
      :open="true"
      @change-children="changeChildren"
    )
    .dito-tree-form-container(
      v-if="isEditingItem"
    )
      DitoRouterView(:routeLevel="routeContext.level + 1")
</template>

<script>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { defineType } from '../utils/schema/types.ts'
import { sourceTraits } from './traits.ts'
import { fieldProps } from '../composables/useField.ts'
import { useSource } from '../composables/useSource.ts'
import { resolveSchemaComponents } from '../utils/schema/setup.js'
import { getParentDataPath } from '../utils/data.js'

// @vue/component
const DitoTypeTreeList = {
  name: 'DitoTypeTreeList',
  props: fieldProps,

  setup(props) {
    const router = useRouter()
    const source = useSource(props)
    const { services, value, isListSource, onChange } = source
    return {
      ...source,
      routeContext: computed(() => services.routeContext),

      // The forms of the tree's items are routed right after its route:
      isEditingItem: computed(() => {
        const node = source.sourceNode.value
        let routeNode = (
          node &&
          router.currentRoute.value.matched[services.routeContext.level + 1]
            ?.meta.node
        )
        while (routeNode && routeNode !== node) {
          routeNode = routeNode.parent
        }
        return !!routeNode
      }),

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
        source.isObjectSource.value ? source.objectPath.value : null
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
  component: DitoTypeTreeList,
  // The forms of their children are routed next to theirs:
  nestForms: true,

  getChildSourceSchemas(schema) {
    return schema.children ? [schema.children] : []
  },

  async processSchema(api, schema, name) {
    const { children } = schema
    if (children) {
      children.type = 'tree-list'
    }
    await Promise.all([
      resolveSchemaComponents(schema.properties),
      sourceTraits.processSchema(api, schema, name),
      children && treeTraits.processSchema(api, children, children.name)
    ])
  }
}

defineType({ ...treeTraits, type: 'tree-list', sourceType: 'list' })
defineType({ ...treeTraits, type: 'tree-object', sourceType: 'object' })

export default DitoTypeTreeList
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-tree-list {
  @extend %field;

  .dito-tree-panel {
    display: flex;
    justify-content: space-between;

    > .dito-tree-item {
      flex: 1 1 25%;
    }

    > .dito-tree-form-container {
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
