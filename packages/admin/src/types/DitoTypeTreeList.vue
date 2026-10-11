<template lang="pug">
.dito-tree-list
  DitoScopes(
    v-if="scopes"
    :query="query"
    :scopes="scopes"
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
      //- Include a router-view for the optional DitoFormInlined
      DitoRouterView(:routeLevel="routeComponent.routeLevel + 1")
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import SourceMixin from '../mixins/SourceMixin.js'
import { resolveSchemaComponents } from '../utils/schema/setup.js'
import { getFormSchemas } from '../utils/schema/lookup.js'
import { appendDataPath, getParentDataPath } from '../utils/data.js'
import { isPathWithin } from '../utils/route.js'

export default DitoTypeComponent.register(
  ['tree-list', 'tree-object'],
  // @vue/component
  {
    mixins: [SourceMixin],

    getSourceType(type) {
      return type === 'tree-object' ? 'object' : 'list'
    },

    computed: {
      // The forms of the items of the tree are routed right after its route
      // component, if there is one:
      isEditingItem() {
        const { sourceNode } = this
        const level = this.routeComponent?.routeLevel
        let node = sourceNode && this.$route.matched[level + 1]?.meta.node
        while (node && node !== sourceNode) {
          node = node.parent
        }
        return !!node
      },

      treeData() {
        return this.isListSource
          ? { [this.name]: this.value }
          : this.value
      },

      treeDataPath() {
        // Remove `name` from `dataPath`, as it is added
        // to `treeData` and `treeSchema`
        return this.isListSource
          ? getParentDataPath(this.dataPath)
          : this.dataPath
      },

      // Tree objects are edited in the form of their root item:
      rootPath() {
        return this.isObjectSource ? this.objectPath : null
      },

      treeSchema() {
        return this.isListSource
          ? {
              children: {
                name: this.name,
                ...this.schema
              }
            }
          : this.schema
      }
    },

    methods: {
      // Replaces the children of the tree item at `dataPath`, as the only
      // writer of the tree, see `DitoTreeItem.changeChildren()`.
      changeChildren({ data, dataPath, childrenSchema, children }) {
        const { name } = childrenSchema
        const list = data[name]
        // Keep the form of an edited child, or of one of its descendants, open
        // at the child's new index, or close it if the child was removed:
        const getChildPath = index =>
          this.getFormPath(appendDataPath(dataPath, `${name}/${index}`))
        const { path: routePath, query } = this.$route
        const editedIndex = list.findIndex((child, index) => {
          const path = getChildPath(index)
          return !!path && isPathWithin(routePath, path)
        })
        const editedChild = list[editedIndex]
        const editedPath = editedIndex >= 0 ? getChildPath(editedIndex) : null
        this.dataModel.replaceChildren(list, children)
        if (editedPath) {
          const index = list.indexOf(editedChild)
          if (index !== editedIndex) {
            const path =
              index >= 0
                ? getChildPath(index) + routePath.slice(editedPath.length)
                : this.routeComponent.path
            this.$router.push({ path, query })
          }
        }
        this.onChange()
      }
    },

    // The forms of tree items render inside the form or view of the tree,
    // and the forms of their children next to theirs:
    hasNestedForms: true,

    getChildSourceSchemas(schema) {
      return schema.children ? [schema.children] : []
    },

    async processSchema(api, schema, name) {
      const { children } = schema
      if (children) {
        // Add `type` to the nested tree list.
        children.type = 'tree-list'
      }
      await Promise.all([
        resolveSchemaComponents(schema.properties),
        SourceMixin.processSchema(api, schema, name),
        children && this.processSchema(api, children, children.name)
      ])
    },

    getFormSchemasForProcessing(schema, context) {
      // Convert nested children schema to stand-alone schema component,
      // present in each of the forms, as required by `processSchemaData()`
      const { children } = schema
      return getFormSchemas(
        schema,
        context,
        children
          ? form => ({
              ...form,
              components: {
                ...form.components,
                [children.name]: children
              }
            })
          : null
      )
    }
  }
)
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
