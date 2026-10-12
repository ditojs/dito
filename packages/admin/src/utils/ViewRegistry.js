import { shallowRef } from 'vue'
import { mapConcurrently } from '@ditojs/utils'
import { resolveViews, setupView } from './schema/setup.js'
import { RouteTree } from './RouteTree.ts'

// The views are resolved anew for each login, as the schemas may depend on the
// user, e.g. through functions or modules that request the API.

export class ViewRegistry {
  #api
  #router
  #unresolvedViews
  #routeComponents
  #views = shallowRef({})
  #routeTree = shallowRef(null)
  #removeRoutes = null

  constructor({ api, router, unresolvedViews, routeComponents }) {
    this.#api = api
    this.#router = router
    this.#unresolvedViews = unresolvedViews
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
    try {
      views = await resolveViews(this.#unresolvedViews)
    } catch (error) {
      console.error(error)
      return false
    }
    await mapConcurrently(Object.entries(views), ([name, schema]) =>
      setupView(this.#api, schema, name)
    )
    const routeTree = new RouteTree(views, this.#api)
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

function addRoutes(router, routes) {
  const removers = routes.map(route => router.addRoute(route))
  return () => {
    for (const remove of removers) {
      remove()
    }
  }
}
