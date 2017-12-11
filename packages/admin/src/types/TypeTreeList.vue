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
        :root="true"
        :open="true"
        :childrenOpen="true"
        :path="''"
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
      edit: null
    }
  },

  computed: {
    editPath() {
      const { matched, params } = this.$route
      const last = matched[matched.length - 1]
      const { parent } = last
      return last.meta === parent.meta
        ? last.path.substring(parent.path.length)
          .replace(/:(id\d+)/g, (all, id) => params[id])
        : ''
    },

    rootPath() {
      return this.formComponent.metaPath
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
