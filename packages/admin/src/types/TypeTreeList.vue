<template lang="pug">
  .dito-tree-list
    dito-scopes(
      v-if="scopes"
      :query="query"
      :scopes="scopes"
    )
    .dito-tree-panel
      dito-tree-item(
        :data="treeData"
        :schema="treeSchema"
        :dataPath="treeDataPath"
        :open="true"
      )
      // Include a router-view for the optional DitoFormInlined
      router-view
</template>

<style lang="sass">
.dito
  .dito-tree-list
    .dito-tree-panel
      display: flex
      justify-content: space-between
      > .dito-tree-item
        flex: initial
      > .dito-form-nested
        background: $color-lightest
        border-radius: $border-radius
        margin-left: $content-padding
        width: 0 // let it grow to size
        max-width: 75%
        align-self: flex-start
</style>

<script>
import TypeComponent from '@/TypeComponent'
import SourceMixin from '@/mixins/SourceMixin'
import { hasForms } from '@/utils/schema'

export default TypeComponent.register([
  'tree-list', 'tree-object'
],
// @vue/component
{
  mixins: [SourceMixin],

  provide() {
    return {
      container: this
    }
  },

  getSourceType(type) {
    return type === 'tree-object' ? 'object' : 'list'
  },

  computed: {
    path() {
      // Accessed from DitoTreeItem through `container.path`:
      return this.formComponent?.path
    },

    editPath() {
      // Accessed from DitoTreeItem through `container.editPath`:
      return this.$route.path.substring(this.path?.length)
    },

    treeData() {
      return this.isListSource
        ? { [this.name]: this.value }
        : this.value
    },

    treeDataPath() {
      // Remove `name` from `dataPath`, as it is addeed
      // to `treeData` and `treeSchema`
      return this.isListSource
        ? this.dataPath.substring(0, this.dataPath.length - this.name.length)
        : this.dataPath
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

  async processSchema(
    api, schema, name, routes, level,
    nested = true, flatten = false,
    process = null
  ) {
    return SourceMixin.processSchema(
      api, schema, name, routes, level,
      nested, flatten,
      // Pass process() to add more routes to childRoutes:
      (childRoutes, level) => {
        const { children } = schema
        if (hasForms(children)) {
          // Add `type` to the nested tree list.
          children.type = 'tree-list'
          return this.processSchema(
            api, children, children.name, childRoutes, level,
            nested, true, // Pass `true` for `flatten` in tree lists.
            process
          )
        }
      }
    )
  }
})
</script>
