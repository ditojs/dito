<template lang="pug">
  .dito-tree-list
    dito-scopes(
      v-if="scopes"
      :query="query"
      :scopes="scopes"
    )
    .dito-tree-content
      dito-tree-item(
        :data="{ [name]: value }"
        :schema="{ [name]: schema }"
        :path="''"
        :open="true"
        :target="this"
      )
      template(v-if="edit")
        dito-panel(
          :schema="edit.schema"
          :data="edit.item"
          :meta="inlineMeta"
          :prefix="edit.prefix"
          :store="store"
          :disabled="loading"
        )
</template>

<style lang="sass">
.dito
  .dito-tree-list
    .dito-tree-content
      display: flex
      > .dito-tree-item
        flex: 0 1 auto
      > .dito-panel
        margin-left: $form-margin
        width: 0 // let it grow to size
        flex: 1 1 auto
        align-self: flex-start
      // Allow edit buttons to position themselves at the end of lines by default
      // display: inline-block
</style>

<script>
import TypeComponent from '@/TypeComponent'
import ListMixin from '@/mixins/ListMixin'
import { isObject } from '@/utils'

export default TypeComponent.register('tree-list', {
  mixins: [ListMixin],

  data() {
    return {
      // Set from DitoTreeItem through `target.edit`:
      edit: null
    }
  },

  computed: {
    rootPath() {
      // Accessed from DitoTreeItem through `target.rootPath`:
      return this.formComponent.rootPath
    },

    editPath() {
      // Accessed from DitoTreeItem through `target.editPath`:
      const { formComponent } = this
      return formComponent.path.substring(formComponent.rootPath.length)
    }
  },

  processSchema
})

async function processSchema(listSchema, name, api, routes, parentMeta, level) {
  return ListMixin.processListSchema(listSchema, name, api, routes, parentMeta,
    level, true,
    // Pass processSchema() to add more routes to childRoutes:
    (childRoutes, parentMeta, level) => {
      const promises = []
      for (const [name, schema] of Object.entries(listSchema)) {
        if (name !== 'form' && isObject(schema)) {
          promises.push(
            processSchema(schema, name, api, childRoutes, parentMeta, level)
          )
        }
      }
      return Promise.all(promises)
    })
}
</script>
