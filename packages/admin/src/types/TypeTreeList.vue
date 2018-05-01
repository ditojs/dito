<template lang="pug">
  .dito-tree-list
    dito-scopes(
      v-if="scopes"
      :query="query"
      :scopes="scopes"
    )
    .dito-tree-panel
      dito-tree-item(
        :data="rootData"
        :schema="rootSchema"
        :open="true"
      )
      router-view
</template>

<style lang="sass">
.dito
  .dito-tree-list
    .dito-tree-panel
      display: flex
      justify-content: space-between
      > .dito-tree-item
        flex: 0 1 auto
      > .dito-nested-form
        background: $color-lightest
        border-radius: $border-radius
        padding: $form-margin
        width: 0 // let it grow to size
        flex: 1 1 50%
        max-width: 50%
        align-self: flex-start
        .dito-scroll-content
          padding: 0
</style>

<script>
import TypeComponent from '@/TypeComponent'
import SourceMixin from '@/mixins/SourceMixin'
import { hasForms } from '@/schema'

export default TypeComponent.register(['tree-list', 'tree-object'], {
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

    rootData() {
      return this.isListSource
        ? { [this.name]: this.value }
        : this.value
    },

    rootSchema() {
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

  processSchema
})

async function processSchema(
  api, schema, name, routes, parentMeta, level, nested = true, flatten = false
) {
  return SourceMixin.processSchema(
    api, schema, name, routes, parentMeta, level, nested, flatten,
    // Pass process() to add more routes to childRoutes:
    (childRoutes, parentMeta, level) => {
      const { children } = schema
      if (children) {
        const { name } = children
        if (hasForms(children)) {
          // Add `type` to the nested tree list.
          children.type = 'tree-list'
          return processSchema(
            // Pass `true` for `flatten` in tree lists.
            api, children, name, childRoutes, parentMeta, level, nested, true
          )
        }
      }
    }
  )
}
</script>
