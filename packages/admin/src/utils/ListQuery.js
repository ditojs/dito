import { pickBy } from '@ditojs/utils'
import { formatQuery } from './route.js'

// The scope, page, order and filters of a list: The route holds them, for
// links and reloads, and the store of the source remembers them for when we
// navigate back. All changes of lists in routes go through the router, lists
// outside of routes, e.g. in dialogs, only store them.
export class ListQuery {
  constructor({
    router,
    getRoute,
    getSourceStore,
    getDefaultQuery,
    isInRoute,
    onChange
  }) {
    this.router = router
    this.getRoute = getRoute
    this.getSourceStore = getSourceStore
    this.getDefaultQuery = getDefaultQuery
    this.isInRoute = isInRoute
    this.onChange = onChange
    this.pendingNavigation = null
  }

  get query() {
    return this.withDefaults(this.getSourceStore().query)
  }

  // A changed query has other pages, so `resetPage` resets the page then:
  update(changes, { resetPage = false } = {}) {
    const { query } = this
    const changedQuery = removeEmptyValues({ ...query, ...changes })
    if (isSameQuery(changedQuery, query)) {
      return Promise.resolve()
    }
    if (resetPage && changedQuery.page != null) {
      changedQuery.page = 0
    }
    if (this.isInRoute()) {
      const promise = this.router.push({
        query: changedQuery,
        // Preserve the hash for tabs:
        hash: this.getRoute().hash
      })
      const navigation = { query: changedQuery, promise }
      this.pendingNavigation = navigation
      const settle = () => {
        if (this.pendingNavigation === navigation) {
          this.pendingNavigation = null
        }
      }
      promise.then(settle, settle)
      return promise
    } else {
      this.getSourceStore().query = changedQuery
      this.onChange()
      return Promise.resolve()
    }
  }

  // Resolve to whether the pending navigation reached its query, as guards
  // may fail or supersede it, or return `null` if there is nothing to await:
  whenNavigated() {
    const navigation = this.pendingNavigation
    if (!navigation || this.isRouteQuery(navigation.query)) {
      return null
    }
    const hasNavigated = () => this.isRouteQuery(navigation.query)
    return navigation.promise.then(hasNavigated, hasNavigated)
  }

  isRouteQuery(query) {
    return isSameQuery(query, this.getRoute().query)
  }

  // The route query, e.g. of links, overrides the stored one, and the route
  // receives the merged query with the defaults:
  syncWithRoute() {
    const route = this.getRoute()
    const query = this.withDefaults({
      ...this.getSourceStore().query,
      ...route.query
    })
    this.getSourceStore().query = query
    if (!isSameQuery(query, route.query)) {
      this.router.replace({ query, hash: route.hash }).catch(console.error)
    }
  }

  // Return whether the stored query changed, which the source then loads:
  setFromRoute(routeQuery) {
    const query = this.withDefaults(routeQuery)
    const hasChanged = !isSameQuery(query, this.query)
    this.getSourceStore().query = query
    return hasChanged
  }

  withDefaults(query) {
    return removeEmptyValues({ ...this.getDefaultQuery(), ...query })
  }
}

function removeEmptyValues(query) {
  return pickBy(query, value => value != null)
}

// Compare like the route, with string values and regardless of key order:
function isSameQuery(query1, query2) {
  const getSearchParams = query => {
    const searchParams = new URLSearchParams(formatQuery(query))
    searchParams.sort()
    return searchParams.toString()
  }
  return getSearchParams(query1) === getSearchParams(query2)
}
