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
        :edit="edit"
        :childrenOpen="true"
        @edit="onEdit"
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
import DitoView from '@/components/DitoView'
import DitoForm from '@/components/DitoForm'
import { isObject } from '@/utils'
import { processForms } from '@/schema'

export default TypeComponent.register('tree-list', {
  mixins: [ListMixin],

  data() {
    return {
      edit: null
    }
  },

  methods: {
    onEdit(edit) {
      this.edit = edit
    }
  },

  processSchema
})

async function processSchema(listSchema, name, api, routes, level) {
  const childRoutes = await processForms(listSchema, api, level) || []
  const promises = []
  for (const [name, schema] of Object.entries(listSchema)) {
    if (name !== 'form' && isObject(schema)) {
      promises.push(processSchema(schema, name, api, childRoutes, level + 1))
    }
  }
  await Promise.all(promises)

  const path = listSchema.path = listSchema.path || api.processPath(name)
  listSchema.name = name
  // TODO: streamline and move to ListMixin
  const { inline = true, nested } = listSchema
  const addRoutes = true
  if (inline) {
    if (nested === false) {
      throw new Error(
        'Lists with inline forms can only work with nested data')
    }
    listSchema.nested = true
  }
  const root = level === 0
  if (addRoutes) {
    const meta = {
      api,
      listSchema
    }
    // Use differently named url parameters on each nested level for id as
    // otherwise they would clash and override each other inside $route.params
    // See: https://github.com/vuejs/vue-router/issues/1345
    const param = `id${level + 1}`
    const formRoute = {
      // While root schemas have their own route records, nested lists in
      // forms do not, and need their path prefixed with the parent's path.
      path: root ? `:${param}` : `${path}/:${param}`,
      component: DitoForm,
      children: childRoutes,
      meta: {
        ...meta,
        param
      }
    }
    if (root) {
      routes.push({
        path: `/${path}`,
        children: [formRoute],
        component: DitoView,
        meta: {
          ...meta,
          schema: listSchema
        }
      })
    } else {
      routes.push(
        // Just redirect back to the form when a nested list route is hit.
        { path, redirect: '.' },
        // Add the prefixed formRoute with its children for nested lists.
        formRoute
      )
    }
  }
  console.log(name)
  console.log(routes)
}
</script>
