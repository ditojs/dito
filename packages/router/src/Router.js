import http from 'http'
import Node from './Node.js'
import Result from './Result.js'

const CHAR_SLASH = '/'.charCodeAt(0)

export default class Router {
  #options

  constructor(options) {
    this.trees = {}
    const { strict, prefix } = options || {}
    this.#options = {
      strict,
      prefix: prefix && !strict ? removeTrailingSlash(prefix) : prefix
    }
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
    const { trees } = this
    return (
      trees[method]?.find(path) ||
      // HEAD requests fall back on GET routes:
      method === 'HEAD' && trees.GET?.find(path) ||
      new Result(this, method, path)
    )
  }

  getAllowedMethods(path = null, exclude = null) {
    exclude = exclude?.toUpperCase()
    const allowed = Object.keys(this.trees).filter(
      method => (
        method !== exclude &&
        (!path || this.trees[method].find(path)?.handler)
      )
    )
    // HEAD is allowed wherever GET is, see `find()`:
    if (
      allowed.includes('GET') &&
      !allowed.includes('HEAD') &&
      exclude !== 'HEAD'
    ) {
      allowed.push('HEAD')
    }
    return allowed
  }

  get(...args) {
    return this.add('GET', ...args)
  }

  post(...args) {
    return this.add('POST', ...args)
  }

  put(...args) {
    return this.add('PUT', ...args)
  }

  patch(...args) {
    return this.add('PATCH', ...args)
  }

  delete(...args) {
    return this.add('DELETE', ...args)
  }

  head(...args) {
    return this.add('HEAD', ...args)
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
    const { strict, prefix } = this.#options
    if (!strict && path !== '/') {
      // When not in strict mode, remove trailing slash from any path except
      // '/', and make sure path starts with '/'
      path = removeTrailingSlash(path)
      if (path.charCodeAt(0) !== CHAR_SLASH) {
        path = '/' + path
      }
    }
    return prefix ? prefix + path : path
  }

  toString(method = 'GET') {
    const tree = this.trees[method.toUpperCase()]
    return tree ? tree.toString() : ''
  }
}

function removeTrailingSlash(path) {
  const { length } = path
  return path.charCodeAt(length - 1) === CHAR_SLASH
    ? path.slice(0, length - 1)
    : path
}
