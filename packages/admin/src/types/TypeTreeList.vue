<template lang="pug">
  .dito-tree-list
    dito-scopes(
      v-if="scopes"
      :query="query"
      :scopes="scopes"
    )
    .dito-tree-panel
      dito-tree-item(
        :data="{ [dataPath]: value }"
        :schema="{ [dataPath]: schema }"
        :open="true"
        :container="this"
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
import ListMixin from '@/mixins/ListMixin'
import { isObject } from '@ditojs/utils'

export default TypeComponent.register('tree-list', {
  mixins: [ListMixin],

  computed: {
    path() {
      // Accessed from DitoTreeItem through `container.path`:
      return this.formComponent?.path
    },

    editPath() {
      // Accessed from DitoTreeItem through `container.editPath`:
      return this.$route.path.substring(this.path?.length)
    }
  },

  processSchema
})

async function processSchema(api, schema, name, routes, parentMeta, level,
  nested = true, flatten = false) {
  return ListMixin.processSchema(
    api, schema, name, routes, parentMeta, level, nested, flatten,
    // Pass processSchema() to add more routes to childRoutes:
    (childRoutes, parentMeta, level) => {
      const promises = []
      for (const [name, schema] of Object.entries(schema)) {
        if (name !== 'form' && isObject(schema)) {
          promises.push(
            // Pass `true` for `flatten` in tree lists.
            processSchema(
              api, schema, name, childRoutes, parentMeta, level, nested, true
            )
          )
        }
      }
      return Promise.all(promises)
    })
}
</script>
