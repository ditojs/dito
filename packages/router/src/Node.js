import { escapeRegExp, getCommonOffset } from '@ditojs/utils'

// Node Types:
const TYPE_STATIC = 0 //      /static/path
const TYPE_PARAM = 1 //       /prefix/:param/suffix, /prefix/*/suffix
const TYPE_MATCH_ANY = 2 //   /prefix/**/suffix

// Keys of wildcards, named `$` and `$$` when their route is set up:
const SYMBOL_PLACEHOLDER = Symbol('$')
const SYMBOL_MATCH_ANY = Symbol('$$')

export default class Node {
  constructor(...args) {
    this.initialize(...args)
  }

  initialize(
    type = TYPE_STATIC,
    prefix = '/',
    children = [],
    parameters = null,
    handler = null
  ) {
    this.type = type
    this.label = prefix[0]
    this.prefix = prefix
    this.children = []
    this.hasMatchAny = false
    this.parameters = parameters
    this.handler = handler
    this.paramKey = null
    for (const child of children) {
      this.addChild(child)
    }
  }

  setup(parameters, handler) {
    this.parameters = parameters
    this.handler = handler
    if (this.type === TYPE_MATCH_ANY) {
      parameters.setupPathPattern(this.prefix)
    }
    parameters.setupWildcardKeys()
  }

  addChild(child) {
    const { children } = this
    if (child.type === TYPE_MATCH_ANY) {
      // `find()` tries match-any children in their order, so insert them
      // before the first less specific one:
      const index = children.findIndex(
        node => (
          node.type === TYPE_MATCH_ANY &&
          compareMatchAnyPatterns(child.prefix, node.prefix) < 0
        )
      )
      children.splice(index >= 0 ? index : children.length, 0, child)
      this.hasMatchAny = true
    } else {
      children.push(child)
    }
  }

  add(path, handler) {
    for (const token of path.split('/')) {
      if (!isWildcard(token) && token.includes('*')) {
        throw new Error(
          `Unsupported wildcard in path: '${
            path
          }'. Use '*' and '**' only as whole segments.`
        )
      } else if (/:.*:/.test(token)) {
        throw new Error(
          `Unsupported params in path: '${
            path
          }'. Use only one param per segment.`
        )
      }
    }
    const parameters = new Parameters()
    for (let pos = 0, length = path.length; pos < length; pos++) {
      const ch = path[pos]
      if (ch === '*' && path[pos + 1] === '*') {
        // Match-any (**): matches any path, with an optional suffix:
        this.insert(TYPE_STATIC, path.slice(0, pos))
        this.insert(TYPE_MATCH_ANY, path, parameters, handler)
        return
      } else if (ch === ':' || ch === '*') {
        // Param (:param) or placeholder (*), a param with a generated key:
        this.insert(TYPE_STATIC, path.slice(0, pos))
        const start = pos + 1 // Skip colon or wildcard.
        pos = getSegmentEnd(path, start)
        parameters.addKey(
          ch === '*' ? SYMBOL_PLACEHOLDER : path.slice(start, pos)
        )
        // Chop out param name or wildcard, but keep a colon for both.
        path = `${path.slice(0, start - 1)}:${path.slice(pos)}`
        length = path.length // Update length after changing path.

        if (start === length) {
          this.insert(TYPE_PARAM, path, parameters, handler)
          return
        }
        pos = start
        this.insert(TYPE_PARAM, path.slice(0, pos), parameters)
      }
    }
    this.insert(TYPE_STATIC, path, parameters, handler)
  }

  insert(type, prefix, parameters = null, handler = null) {
    let current = this
    while (true) {
      // Find the position where the path and the node's prefix start diverging.
      const curPrefix = current.prefix
      const pos = getCommonOffset(curPrefix, prefix)
      if (pos < curPrefix.length) {
        // Split node
        const node = new Node(
          current.type,
          curPrefix.slice(pos),
          current.children,
          current.parameters,
          current.handler
        )
        // Reset parent node to a static and add new node as child to it:
        current.initialize(TYPE_STATIC, curPrefix.slice(0, pos))
        current.addChild(node)
        if (pos < prefix.length) {
          // Create child node
          const node = new Node(type, prefix.slice(pos))
          current.addChild(node)
          current = node // Switch to child to set handler and parameters
        }
      } else if (pos < prefix.length) {
        prefix = prefix.slice(pos)
        const label = prefix[0]
        // Match-any nodes aren't shared, only re-added to replace handlers:
        const child = current.children.find(
          child =>
            child.type === TYPE_MATCH_ANY
              ? child.prefix === prefix
              : child.label === label
        )
        if (child) {
          // Go deeper
          current = child
          continue
        }
        // Create child node
        const node = new Node(type, prefix)
        current.addChild(node)
        current = node // Switch to child to set handler and parameters
      }
      if (parameters) {
        // Remember the last entry from the list of param names that keeps
        // growing during parsing as the name of the current node, before
        // `setup()` names the wildcards.
        current.paramKey = parameters.getLastKey()
      }
      if (handler) {
        current.setup(parameters, handler)
      }
      break
    }
  }

  find(path, parameterValues = []) {
    const { prefix } = this
    if (!path || path === prefix) {
      // It's a match!
      const { handler } = this
      if (handler) {
        const params = this.parameters.getObject(parameterValues)
        // Support HTTP status on found entries.
        return { handler, params, status: 200 }
      }
      return null
    }

    const pos = getCommonOffset(prefix, path)
    const prefixLength = prefix.length
    const fullMatch = pos === prefixLength
    if (fullMatch) {
      path = path.slice(prefixLength)
    } else if (this.type !== TYPE_PARAM) {
      // If the path doesn't fully match the prefix, we only need to look
      // further on param nodes, which can have overlapping static children.
      return null
    }

    // Search order: Static > Param > Match-any

    // Static node
    const label = path[0]
    const staticChild = this.children.find(
      child => child.type === TYPE_STATIC && child.label === label
    )
    if (staticChild) {
      const result = staticChild.find(path, parameterValues)
      if (result) {
        return result
      }
    }

    // Only static nodes can follow the value of a param node:
    if (!fullMatch) return null

    // Param node
    const paramChild = this.children.find(child => child.type === TYPE_PARAM)
    if (paramChild) {
      const pos = getSegmentEnd(path, 0)
      parameterValues.push(path.slice(0, pos))
      const result = paramChild.find(path.slice(pos), parameterValues)
      if (result) {
        return result
      }
      parameterValues.pop()
    }

    // Match-any nodes
    if (this.hasMatchAny) {
      for (const child of this.children) {
        const values = child.parameters?.matchPathPattern(path)
        if (values) {
          parameterValues.push(...values)
          return child.find('', parameterValues) // '' == End
        }
      }
    }

    return null
  }

  toString(prefix = '', tail = true, root = true) {
    const handler = this.handler && `${this.handler.name || 'ƒ'}()`
    const format = (prefix, tail, on, off) =>
      root ? '' : `${prefix}${tail ? on : off}`
    const { children } = this
    const lines = [
      `${format(prefix, tail, '└── ', '├── ')}${
        this.type === TYPE_PARAM
          ? this.paramKey === SYMBOL_PLACEHOLDER
            ? '*'
            : `${this.prefix}${this.paramKey}`
          : this.prefix
      }${
        handler ? ` ${handler}` : ''
      } children=${
        children.length
      }`
    ]

    const str = format(prefix, tail, '    ', '│   ')
    for (let i = 0, l = children.length - 1; i <= l; i++) {
      lines.push(children[i].toString(str, i === l, false))
    }
    return lines.join('\n')
  }
}

class Parameters {
  constructor() {
    this.keys = []
    this.pathPattern = null
  }

  addKey(key) {
    this.keys.push(key)
  }

  getLastKey() {
    return this.keys[this.keys.length - 1]
  }

  matchPathPattern(path) {
    return this.pathPattern?.exec(path)?.slice(1)
  }

  setupPathPattern(path) {
    // Replace all '**' with '.+?', all '*' and params with '[^/]+', and match
    // everything else literally:
    const pattern = []
    for (const token of path.split('/')) {
      if (token === '**') {
        pattern.push('(.+?)')
        this.addKey(SYMBOL_MATCH_ANY)
      } else if (token === '*') {
        pattern.push('([^/]+)')
        this.addKey(SYMBOL_PLACEHOLDER)
      } else if (token.startsWith(':')) {
        pattern.push('([^/]+)')
        this.addKey(token.slice(1))
      } else if (token.includes(':')) {
        throw new Error(
          `Unsupported param after '**': '${
            token
          }'. Use params after '**' only as whole segments.`
        )
      } else {
        pattern.push(escapeRegExp(token))
      }
    }
    this.pathPattern = new RegExp(`^${pattern.join('/')}$`)
  }

  setupWildcardKeys() {
    // Name wildcards `$` and `$$`, or `$0`, `$1`, … when there are several:
    for (const symbol of [SYMBOL_PLACEHOLDER, SYMBOL_MATCH_ANY]) {
      const { description } = symbol
      const isNumbered = this.keys.filter(key => key === symbol).length > 1
      let index = 0
      this.keys = this.keys.map(key =>
        key === symbol
          ? isNumbered
            ? `${description}${index++}`
            : description
          : key
      )
    }
  }

  getObject(values) {
    return Object.fromEntries(this.keys.map((key, i) => [key, values[i]]))
  }
}

function getSegmentEnd(path, pos) {
  const end = path.indexOf('/', pos)
  return end >= 0 ? end : path.length
}

// Sort match-any patterns with more segments first, then more static ones:
function compareMatchAnyPatterns(pattern1, pattern2) {
  const tokens1 = pattern1.split('/')
  const tokens2 = pattern2.split('/')
  return (
    tokens2.length - tokens1.length ||
    tokens2.filter(isStaticToken).length - tokens1.filter(isStaticToken).length
  )
}

function isStaticToken(token) {
  return !isWildcard(token) && !token.startsWith(':')
}

function isWildcard(token) {
  return token === '*' || token === '**'
}
