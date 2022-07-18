<template lang="pug">
  .dito-tree-list
    dito-scopes(
      v-if="scopes"
      :query="query"
      :scopes="scopes"
    )
    .dito-tree-panel
      dito-tree-item(
        :schema="treeSchema"
        :dataPath="treeDataPath"
        :data="treeData"
        :draggable="draggable"
        :open="true"
      )
      .dito-tree-form-container(
        v-if="hasEditableForms"
      )
        // Include a router-view for the optional DitoFormInlined
        router-view
</template>

<style lang="sass">
  .dito-tree-list
    @extend %field
    .dito-tree-panel
      display: flex
      justify-content: space-between
      > .dito-tree-item
        flex: 1 1 25%
      > .dito-tree-form-container
        flex: 0 1 75%
        align-self: stretch
        background: $content-color-background
        border-left: $border-style
        border-top-right-radius: $border-radius - 1
        border-bottom-right-radius: $border-radius - 1
        margin: (-$input-padding-ver) (-$input-padding-hor)
        margin-left: $input-padding-hor
</style>

<script>
import TypeComponent from '../TypeComponent.js'
import SourceMixin from '../mixins/SourceMixin.js'
import { hasFormSchema, getFormSchemas } from '../utils/schema.js'

export default TypeComponent.register([
  'tree-list', 'tree-object'
],
// @vue/component
{
  mixins: [SourceMixin],

  provide() {
    return { container: this }
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
      return this.$route.path.slice(this.path?.length)
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
        ? this.dataPath.slice(0, this.dataPath.length - this.name.length)
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
    },

    hasEditableForms() {
      const hasEditableForms = schema => {
        return (
          hasFormSchema(schema) && (
            this.getSchemaValue('editable', {
              type: Boolean,
              default: false,
              schema
            }) ||
            schema.children &&
            hasEditableForms(schema.children)
          )
        )
      }
      return hasEditableForms(this.schema)
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
        if (children) {
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
  },

  getFormSchemasForProcessing(schema, context) {
    // Convert nested children schema to stand-alone schema component,
    // present in each of the forms, as required by `processSchemaData()`
    const { children } = schema
    return getFormSchemas(schema, context, children
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
})
</script>
