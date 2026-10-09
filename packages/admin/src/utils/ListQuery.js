import { pickBy } from '@ditojs/utils'
import { formatQuery } from './route.js'

// The query of a source that loads its list through its resource, e.g. its
// scope, page, order and filters, see `ResourceMixin.queryParams`. The route
// holds the query, so that the list can be linked and reloaded, and the store
// of the source remembers it, so that the list shows it again when navigating
// back to it, see `DitoMixin.getStore()`. All changes of the query go through
// the router, and the source loads its list when the route query changes, see
// the `$route` watcher in `SourceMixin`.
export class ListQuery {
  constructor({ router, getRoute, getSourceStore, getDefaultQuery }) {
    this.router = router
    this.getRoute = getRoute
    this.getSourceStore = getSourceStore
    this.getDefaultQuery = getDefaultQuery
    // The navigation of the last `update()` while it is pending, with the
    // query that it navigates to, see `whenNavigated()`.
    this.pendingNavigation = null
  }

  // The stored query, with the defaults of the source for missing values.
  get query() {
    return this.withDefaults(this.getSourceStore().query)
  }

  // Navigates to the query with `changes`, e.g. `{ scope: 'published' }`.
  // With `resetPage`, a set page is reset to the first one if the changes
  // change the query, as the list then has other pages.
  update(changes, { resetPage = false } = {}) {
    const { query } = this
    const changedQuery = removeEmptyValues({ ...query, ...changes })
    if (isSameQuery(changedQuery, query)) {
      return Promise.resolve()
    }
    if (resetPage && changedQuery.page != null) {
      changedQuery.page = 0
    }
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
  }

  // Returns `null` if no navigation of `update()` is pending, or the route
  // already holds its query. Otherwise returns a promise that resolves once
  // it settled, to whether the route then holds its query, as the navigation
  // may fail or be superseded, e.g. by a navigation guard.
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

  // Merges the stored query with the route query, so that the list shows the
  // same query again when navigating back to it, while the route query can
  // override it, e.g. through links. The route query is replaced with the
  // merged query, so that it holds the defaults and the stored values too.
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

  // Stores the query of the route after it changed, and returns whether it
  // changed the stored query, which the source then needs to load.
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

// Compares queries like the route does, where all values are strings, and
// regardless of the order of their keys.
function isSameQuery(query1, query2) {
  const getSearchParams = query => {
    const searchParams = new URLSearchParams(formatQuery(query))
    searchParams.sort()
    return searchParams.toString()
  }
  return getSearchParams(query1) === getSearchParams(query2)
}
