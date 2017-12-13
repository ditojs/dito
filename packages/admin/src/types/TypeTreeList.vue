<template lang="pug">
  .dito-tree-list
    dito-scopes(
      v-if="scopes"
      :query="query"
      :scopes="scopes"
    )
    .dito-tree-panel
      dito-tree-item(
        :data="{ [name]: value }"
        :schema="{ [name]: schema }"
        :open="true"
        :parentComponent="this"
      )
      dito-nested-form(
        v-if="editInfo"
        :meta="nestedMeta"
        :store="store"
        :prefix="editInfo.prefix"
        :listData="editInfo.listData"
        :listIndex="editInfo.listIndex"
        :listSchema="editInfo.listSchema"
        :disabled="loading"
        :parentComponent="this"
      )
</template>

<style lang="sass">
.dito
  .dito-tree-list
    .dito-tree-panel
      display: flex
      > .dito-tree-item
        flex: 0 1 auto
      > .dito-form
        margin-left: $form-margin
        width: 0 // let it grow to size
        flex: 1 1 auto
        align-self: flex-start
        .dito-content
          padding: 0
</style>

<script>
import TypeComponent from '@/TypeComponent'
import ListMixin from '@/mixins/ListMixin'
import { isObject } from '@/utils'

export default TypeComponent.register('tree-list', {
  mixins: [ListMixin],

  data() {
    return {
      // Set from DitoTreeItem through `parentComponent.edit`:
      editInfo: null
    }
  },

  computed: {
    rootPath() {
      // Accessed from DitoTreeItem through `parentComponent.rootPath`:
      return this.formComponent?.rootPath
    },

    editPath() {
      // Accessed from DitoTreeItem through `parentComponent.editPath`:
      const { formComponent } = this
      return formComponent?.path.substring(formComponent.rootPath.length)
    }
  },

  methods: {
    edit(info) {
      this.editInfo = info
    }
  },

  processSchema
})

async function processSchema(listSchema, name, api, routes, parentMeta, level) {
  return ListMixin.processSchema(listSchema, name, api, routes, parentMeta,
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
