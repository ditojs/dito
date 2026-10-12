<template lang="pug">
.dito-tree-list
  DitoScopes(
    v-if="scopes"
    :listQuery="listQuery"
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
      DitoRouterView(:routeLevel="route.level + 1")
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import { defineType } from '../utils/schema/types.ts'
import { sourceDescriptor } from './descriptors.ts'
import SourceMixin from '../mixins/SourceMixin.js'
import { resolveSchemaComponents } from '../utils/schema/setup.js'
import { getParentDataPath } from '../utils/data.js'

// @vue/component
const DitoTypeTreeList = DitoTypeComponent.component('DitoTypeTreeList', {
  mixins: [SourceMixin],

  computed: {
    // The forms of the items of the tree are routed right after its route
    // component, if there is one:
    isEditingItem() {
      const { sourceNode } = this
      let node = (
        sourceNode &&
        this.$route.matched[this.route.level + 1]?.meta.node
      )
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
    // Replaces the children of the tree item, as the only writer of the tree,
    // see `DitoTreeItem.changeChildren()`. Open forms follow their items,
    // see `DitoForm.setupSourceItem()`.
    changeChildren({ entry, children }) {
      this.dataModel.replaceChildren(entry, children)
      this.onChange()
    }
  }
})

const treeDescriptor = {
  ...sourceDescriptor,
  component: DitoTypeTreeList,
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
      sourceDescriptor.processSchema(api, schema, name),
      children && treeDescriptor.processSchema(api, children, children.name)
    ])
  }
}

defineType({ ...treeDescriptor, types: ['tree-list'], sourceType: 'list' })
defineType({ ...treeDescriptor, types: ['tree-object'], sourceType: 'object' })

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
