import { shallowRef } from 'vue'
import { mapConcurrently } from '@ditojs/utils'
import {
  resolveViews,
  setupView,
  resetProcessedSchemaDepths
} from './schema/setup.js'

// ViewRegistry resolves the schemas of the admin's views, sets up their routes,
// and adds them to the router, replacing the routes of the previous resolve.
// `Session` resolves the views anew for each login and clears them once the
// user is logged out, as the schemas may depend on the user, e.g. on functions
// or modules that request the API. `views` and `hasRoutes` are reactive.

export class ViewRegistry {
  #api
  #router
  #unresolvedViews
  #viewComponent
  #views = shallowRef({})
  #removeRoutes = shallowRef(null)

  constructor({ api, router, unresolvedViews, viewComponent }) {
    this.#api = api
    this.#router = router
    this.#unresolvedViews = unresolvedViews
    this.#viewComponent = viewComponent
  }

  // The resolved views, provided as `$views`, or an empty object until they
  // are resolved and once they are cleared.
  get views() {
    return this.#views.value
  }

  // Whether the routes of the views were added to the router.
  get hasRoutes() {
    return !!this.#removeRoutes.value
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
    // The schemas may be the same objects as in the previous resolve, which
    // need to be processed again for their routes.
    resetProcessedSchemaDepths()
    const routes = await mapConcurrently(
      Object.entries(views),
      ([name, schema]) =>
        setupView(this.#viewComponent, this.#api, schema, name)
    )
    // Only provide the views once they are set up, as `DitoMenu` links to
    // their paths.
    this.#views.value = views
    const { fullPath } = this.#router.currentRoute.value
    this.#removeRoutes.value?.()
    this.#removeRoutes.value = addRoutes(this.#router, [
      {
        name: 'root',
        path: '/',
        components: {}
      },
      ...routes.flat()
    ])
    this.#router.replace(fullPath)
    return true
  }

  // Clears the views, e.g. once the user is logged out, and navigates home.
  // Their routes stay until the views are resolved again.
  clear() {
    this.#views.value = {}
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
