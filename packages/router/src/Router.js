import Node from './Node'
import http from 'http'

export default class Router {
  constructor(options) {
    this.trees = {}
    this._options = options || {}
  }

  add(method, path, handler) {
    method = method.toUpperCase()
    path = this.normalizePath(path)
    const tree = this.trees[method] || (this.trees[method] = new Node())
    tree.add(path, handler)
    return this
  }

  find(method, path) {
    method = method.toUpperCase()
    path = this.normalizePath(path)
    const tree = this.trees[method]
    let result = tree?.find(path)
    if (!result) {
      // Send 405 / 501 errors, except for 'GET' (404) and 'OPTIONS' (200).
      // 405: 'Method Not Allowed' (tree was found, but node was not)
      // 501: 'Method Not Implemented' (there is no tree for that method)
      result = {
        status: (
          { GET: 404, OPTIONS: 200 }[method] ||
          (tree ? 405 : 501)
        )
      }
      // Define a computed `allowed` property that is cached after first call.
      Object.defineProperty(result, 'allowed', {
        get: () => {
          const allowed = tree
            ? this.getAllowedMethods(path, method)
            : this.getAllowedMethods()
          // Redefine `allowed` property with computed value.
          Object.defineProperty(result, 'allowed', {
            value: allowed,
            configurable: true,
            enumerable: true
          })
          return allowed
        },
        configurable: true,
        enumerable: true
      })
    }
    return result
  }

  getAllowedMethods(path = null, exclude = null) {
    if (path) {
      const allowed = []
      // Search for allowed methods in all trees.
      for (const method in this.trees) {
        if (method === exclude) {
          continue
        }
        const tree = this.trees[method]
        if (tree.find(path)?.handler) {
          allowed.push(method)
        }
      }
      return allowed
    } else {
      return Object.keys(this.trees)
    }
  }

  get(...args) {
    return this.add('GET', ...args)
  }

  put(...args) {
    return this.add('PUT', ...args)
  }

  post(...args) {
    return this.add('POST', ...args)
  }

  delete(...args) {
    return this.add('DELETE', ...args)
  }

  head(...args) {
    return this.add('HEAD', ...args)
  }

  patch(...args) {
    return this.add('PATCH', ...args)
  }

  options(...args) {
    return this.add('OPTIONS', ...args)
  }

  trace(...args) {
    return this.add('TRACE', ...args)
  }

  connect(...args) {
    return this.add('CONNECT', ...args)
  }

  all(...args) {
    for (const method of http.METHODS) {
      this.add(method, ...args)
    }
    return this
  }

  normalizePath(path) {
    const { strict, prefix } = this._options
    if (!strict) {
      // When not in strict mode, remove trailing slash from any path except
      // '/', and make sure path starts with '/'
      path = `/${path.match(/^\/?(.*?)\/?$/)[1]}`
    }
    return prefix ? prefix + path : path
  }

  toString(method = 'GET') {
    const tree = this.trees[method.toUpperCase()]
    return tree ? tree.toString() : ''
  }
}
