import { shallowRef } from 'vue'
import { mapConcurrently } from '@ditojs/utils'
import { resolveViews, setupView } from './schema/setup.js'
import { RouteTree } from './RouteTree.ts'

// ViewRegistry resolves the schemas of the admin's views, sets up their routes,
// and adds them to the router, replacing the routes of the previous resolve.
// `Session` resolves the views anew for each login and clears them once the
// user is logged out, as the schemas may depend on the user, e.g. on functions
// or modules that request the API. `views` and `routeTree` are reactive.

export class ViewRegistry {
  #api
  #router
  #unresolvedViews
  #viewComponent
  #views = shallowRef({})
  #routeTree = shallowRef(null)
  #removeRoutes = null

  constructor({ api, router, unresolvedViews, viewComponent }) {
    this.#api = api
    this.#router = router
    this.#unresolvedViews = unresolvedViews
    this.#viewComponent = viewComponent
  }

  // The resolved views, or an empty object until they are resolved and once
  // they are cleared.
  get views() {
    return this.#views.value
  }

  // The route tree of the resolved views, `null` until they are resolved.
  get routeTree() {
    return this.#routeTree.value
  }

  // Resolves the views and replaces the routes of the previous resolve with
  // theirs, keeping the current path. Returns `false` if the views couldn't be
  // resolved, e.g. because the API refused a request of their schemas.
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
      {
        name: 'root',
        path: '/',
        components: {}
      },
      ...routeTree.createRouteRecords(this.#viewComponent)
    ])
    // Only provide the views and their tree once their routes are added, as
    // `DitoMenu` links to them by their names.
    this.#routeTree.value = routeTree
    this.#views.value = views
    this.#router.replace(fullPath)
    return true
  }

  // Clears the views, e.g. once the user is logged out, and navigates home.
  // Their routes stay until the views are resolved again.
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
