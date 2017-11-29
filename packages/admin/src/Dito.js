import Vue from 'vue'
import VueRouter from 'vue-router'
import VeeValidate from 'vee-validate'
import './components'
import './types'
import TypeComponent from './TypeComponent'
import DitoRoot from './components/DitoRoot'
import DitoView from './components/DitoView'
import DitoForm from './components/DitoForm'
import { isFunction, hyphenate } from './utils'

Vue.config.productionTip = false
Vue.use(VueRouter)
Vue.use(VeeValidate, {
  // See: https://github.com/logaretm/vee-validate/issues/468
  inject: false,
  // Prefix `errors` and `fields with $ to make it clear they're special props:
  errorBagName: '$errors',
  fieldsBagName: '$fields'
})

const user = {
  role: 'admin' // TODO
}

export function setup(el, options) {
  const { schemas, settings, api } = options
  const { normalizePath } = api
  const processPath = isFunction(normalizePath)
    ? normalizePath
    : normalizePath === true
      ? hyphenate
      : val => val

  function processList(listSchema, name, routes, level) {
    // TODO: Allow dynamic forms!
    const formSchema = listSchema.form
    const path = listSchema.path = listSchema.path || processPath(name)
    listSchema.name = name
    const { inline, nested } = listSchema
    const addRoutes = !inline
    if (inline) {
      if (nested === false) {
        throw new Error(
          'Lists with inline forms can only work with nested data')
      }
      listSchema.nested = true
    }
    const root = level === 0
    // While root schemas have their own vue route objects, nested lists in
    // forms don't have their own route objects and need their path prefixed.
    const pathPrefix = root ? '' : `${path}/`
    const meta = addRoutes && { user, api }
    const formRoutes = formSchema
      ? processForm(formSchema, listSchema, meta, pathPrefix, level)
      : []
    if (addRoutes) {
      routes.push(
        root
          ? {
            path: `/${path}`,
            ...formRoutes.length > 0 && {
              children: formRoutes
            },
            component: DitoView,
            meta: {
              ...meta,
              schema: listSchema,
              listSchema,
              formSchema // TODO: Allow dynamic forms!
            }
          }
          // Just redirect back to the form if the user hits a nested list route
          : {
            path,
            redirect: '.'
          },
        // Include the prefixed formRoutes for nested lists.
        ...(!root && formRoutes)
      )
    }
  }

  function processComponents(components, routes, level) {
    for (const name in components) {
      const schema = components[name]
      if (schema.form) {
        processList(schema, name, routes, level)
      }
    }
  }

  function processForm(formSchema, listSchema, meta, pathPrefix, level) {
    const children = []
    const { tabs } = formSchema
    for (const key in tabs) {
      processComponents(tabs[key].components, children, level + 1)
    }
    processComponents(formSchema.components, children, level + 1)
    // meta is only set when we want to actually produce routes.
    if (meta) {
      // Use differently named url parameters on each nested level for id as
      // otherwise they would clash and override each other inside $route.params
      // See: https://github.com/vuejs/vue-router/issues/1345
      const param = `id${level + 1}`
      return [{
        path: `${pathPrefix}:${param}`,
        component: DitoForm,
        children,
        meta: {
          ...meta,
          schema: formSchema,
          listSchema,
          formSchema,
          param
        }
      }]
    }
  }

  api.resources = {
    member(component, itemId) {
      return `${component.listSchema.path}/${itemId}`
    },

    collection(component) {
      const { parentFormComponent: parentForm, listSchema } = component
      return parentForm
        ? `${parentForm.listSchema.path}/${parentForm.itemId}/${listSchema.path}`
        : listSchema.path
    },
    ...api.resources
  }

  const routes = []

  for (const name in schemas) {
    // TODO: Could be other things than lists in the future: add processSchema()
    processList(schemas[name], name, routes, 0)
  }

  new Vue({
    el,
    router: new VueRouter({
      mode: 'history',
      routes
    }),
    template: '<dito-root :schemas="schemas" :settings="settings" />',
    components: { DitoRoot },
    data: {
      schemas,
      settings
    }
  })
}

export const { register } = TypeComponent

export default {
  setup,
  register
}
