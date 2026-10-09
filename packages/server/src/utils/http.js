import http from 'http'

// The HTTP methods supported by Node.js, in the lower-case notation used by
// routes and action names, e.g. `'get'` or `'post'`.
const httpMethods = new Set(http.METHODS.map(method => method.toLowerCase()))

export function isHttpMethod(method) {
  return httpMethods.has(method)
}
