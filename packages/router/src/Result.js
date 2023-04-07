const SYMBOL_ALLOWED = Symbol('allowed')

export default class Result {
  constructor(router, method, path, tree) {
    // Send 405 / 501 errors, except for 'GET' (404) and 'OPTIONS' (200).
    // 405: 'Method Not Allowed' (tree was found, but node was not)
    // 501: 'Method Not Implemented' (there is no tree for that method)
    this.status = (
      {
        GET: 404,
        get: 404,
        options: 200,
        OPTIONS: 200
      }[method] ||
      (tree ? 405 : 501)
    )
    // Getter for the `allowed` property, called once, then cached:
    this[SYMBOL_ALLOWED] = () =>
      tree
        ? router.getAllowedMethods(path, method)
        : router.getAllowedMethods()
  }

  get allowed() {
    const allowed = this[SYMBOL_ALLOWED]()
    // Redefine `allowed` property with computed value.
    Object.defineProperty(this, 'allowed', {
      value: allowed,
      configurable: true
    })
    return allowed
  }
}
