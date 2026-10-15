import { shallowRef } from 'vue'
import { mapConcurrently } from '@ditojs/utils'
import { resolveSchema, resolveViews, setupView } from './schema/setup.js'
import { RouteTree } from './RouteTree.ts'

// The views are resolved anew for each login, as the schemas may depend on the
// user, e.g. through functions or modules that request the API.

export class ViewRegistry {
  #api
  #router
  #unresolvedViews
  #account
  #routeComponents
  #views = shallowRef({})
  #routeTree = shallowRef(null)
  #removeRoutes = null

  constructor({ api, router, unresolvedViews, account, routeComponents }) {
    this.#api = api
    this.#router = router
    this.#unresolvedViews = unresolvedViews
    this.#account = account
    this.#routeComponents = routeComponents
  }

  get views() {
    return this.#views.value
  }

  get routeTree() {
    return this.#routeTree.value
  }

  // Return `false` if the views can't be resolved, e.g. as the API refused a
  // request of their schemas:
  async resolve() {
    let views
    let hiddenViews
    try {
      views = await resolveViews(this.#unresolvedViews)
      hiddenViews = await resolveAccountViews(this.#api, this.#account)
    } catch (error) {
      console.error(error)
      return false
    }
    await mapConcurrently(
      [...Object.entries(views), ...Object.entries(hiddenViews)],
      ([name, schema]) => setupView(this.#api, schema, name)
    )
    const routeTree = new RouteTree(views, this.#api, hiddenViews)
    const { fullPath } = this.#router.currentRoute.value
    this.#removeRoutes?.()
    this.#removeRoutes = addRoutes(this.#router, [
      { name: 'root', path: '/', components: {} },
      ...routeTree.createRouteRecords(this.#routeComponents)
    ])
    // Only provide the views once their routes are added, as `DitoMenu` links
    // to them by their names:
    this.#routeTree.value = routeTree
    this.#views.value = views
    this.#router.replace(fullPath)
    return true
  }

  // The routes stay until the views are resolved again:
  clear() {
    this.#views.value = {}
    this.#routeTree.value = null
    return this.#router.push('/')
  }
}

// The account settings edit the own user, in a view without a menu item:
async function resolveAccountViews(api, { settings } = {}) {
  const form = settings && (await resolveSchema(settings, true))
  return form
    ? {
        accountSettings: {
          type: 'view',
          label: form.label ?? 'Settings',
          path: 'account/settings',
          component: { type: 'object', resource: api.users.self, form }
        }
      }
    : {}
}

function addRoutes(router, routes) {
  const removers = routes.map(route => router.addRoute(route))
  return () => {
    for (const remove of removers) {
      remove()
    }
  }
}
