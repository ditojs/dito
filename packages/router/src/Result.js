export default class Result {
  #getAllowed
  #allowed

  constructor(router, method, path) {
    this.#getAllowed = () => router.getAllowedMethods(path, method)
    // 404: 'Not Found' (always for GET / HEAD, and if no method handles path)
    // 200: For OPTIONS, along with the allowed methods
    // 405: 'Method Not Allowed' (there are routes for the method)
    // 501: 'Not Implemented' (there are no routes for the method)
    this.status =
      method === 'GET' || method === 'HEAD' || this.allowed.length === 0
        ? 404
        : method === 'OPTIONS'
          ? 200
          : router.trees[method]
            ? 405
            : 501
  }

  get allowed() {
    // Only look up `allowed` when needed, as misses of GET and HEAD are 404
    // without it, e.g. for requests handled by later middleware:
    return (this.#allowed ??= this.#getAllowed())
  }
}
