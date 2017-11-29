import Vue from 'vue'
import VueRouter from 'vue-router'
import VeeValidate from 'vee-validate'
import './components'
import './types'
import TypeComponent from './TypeComponent'
import DitoRoot from './components/DitoRoot'
import DitoView from './components/DitoView'
import DitoForm from './components/DitoForm'
import { isFunction, isPromise, hyphenate } from './utils'

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

export async function setup(el, options) {
  const { schemas, settings, api } = options
  const { normalizePath } = api

  api.processPath = isFunction(normalizePath)
    ? normalizePath
    : normalizePath === true
      ? hyphenate
      : val => val

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

  const all = []
  for (const name in schemas) {
    // TODO: Could be other things than lists in the future: add processSchema()
    all.push(processList(api, schemas[name], name, routes, 0))
  }
  await Promise.all(all)

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

async function importForm(formSchema) {
  // When dynamically importing forms, try figuring out and setting their
  // name, if they were declared as named imports:
  formSchema = await formSchema
  if (formSchema && !formSchema.components) {
    const name = Object.keys(formSchema)[0]
    formSchema = formSchema[name]
    if (name !== 'default') {
      formSchema.name = name
    }
  }
  return formSchema
}

async function processList(api, listSchema, name, routes, level) {
  // TODO: Allow dynamic forms!
  let formSchema = listSchema.form
  if (isFunction(formSchema)) {
    formSchema = formSchema()
  }
  if (isPromise(formSchema)) {
    formSchema = await importForm(formSchema)
  }
  const path = listSchema.path = listSchema.path || api.processPath(name)
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
    ? await processForm(api, formSchema, listSchema, meta, pathPrefix, level)
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

async function processComponents(api, components, routes, level) {
  const all = []
  for (const name in components) {
    const schema = components[name]
    if (schema.form) {
      all.push(processList(api, schema, name, routes, level))
    }
  }
  return Promise.all(all)
}

async function processForm(api, formSchema, listSchema, meta, pathPrefix,
  level) {
  const children = []
  const { tabs } = formSchema
  const all = []
  for (const key in tabs) {
    all.push(processComponents(api, tabs[key].components, children, level + 1))
  }
  all.push(processComponents(api, formSchema.components, children, level + 1))
  await Promise.all(all)
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

export const { register } = TypeComponent

export default {
  setup,
  register
}
