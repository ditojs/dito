import { getCommonOffset } from '@ditojs/utils'

// Node Types:
const TYPE_STATIC = 0 //       /static/patch
const TYPE_PARAM = 1 //        /prefix/:param/suffix
const TYPE_PLACEHOLDER = 2 //  /prefix/*/suffix  (a.k.a shallow wildcard)
const TYPE_MATCH_ANY = 3 //    /prefix/**/suffix (a.k.a deep wildcard)

// Char Codes
const CHAR_SLASH = '/'[0]
const CHAR_PARAM = ':'[0]
const CHAR_WILDCARD = '*'[0]

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
    this.children = children
    this.parameters = parameters
    this.handler = handler
    this.paramKey = null
    this.hasMatchAny = false
  }

  setup(parameters, handler) {
    this.parameters = parameters
    this.handler = handler
    if (this.type === TYPE_MATCH_ANY) {
      parameters.setupPathPattern(this.prefix)
    }
  }

  addChild(child) {
    this.children.push(child)
    this.hasMatchAny ||= child.type === TYPE_MATCH_ANY
  }

  add(path, handler) {
    const parameters = new Parameters()
    for (let pos = 0, length = path.length; pos < length; pos++) {
      const ch = path[pos]
      if (ch === CHAR_WILDCARD && path[pos + 1] === CHAR_WILDCARD) {
        // Deep wildcard (**): matches any path, with a optional suffix:
        this.insert(TYPE_STATIC, path.slice(0, pos))
        pos += 2 // Skip '**'.
        this.insert(TYPE_MATCH_ANY, path, parameters, handler)
        return
      } else if (ch === CHAR_PARAM || ch === CHAR_WILDCARD) {
        // Param (:param) or shallow wildcard (*):
        const isWildcard = ch === CHAR_WILDCARD
        const type = isWildcard ? TYPE_PLACEHOLDER : TYPE_PARAM
        this.insert(TYPE_STATIC, path.slice(0, pos))
        pos++ // Skip colon or wildcard.
        const start = pos
        // Move pos to the next occurrence of the slash or the end:
        pos += path.slice(pos).match(/^([^/]*)/)[1].length
        parameters.add(
          isWildcard ? parameters.getPlaceholderKey() : path.slice(start, pos)
        )
        // Chop out param name from path, but keep colon.
        path = path.slice(0, start) + path.slice(pos)
        length = path.length // Update length after changing path.

        if (start === length) {
          this.insert(type, path, parameters, handler)
          return
        }
        pos = start
        this.insert(type, path.slice(0, pos), parameters)
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
        const child = current.children.find(child => child.label === label)
        if (child !== undefined && child.type !== TYPE_MATCH_ANY) {
          // Go deeper
          current = child
          continue
        }
        // Create child node
        const node = new Node(type, prefix)
        current.addChild(node)
        current = node // Switch to child to set handler and parameters
      }
      if (handler) {
        current.setup(parameters, handler)
      }
      if (parameters) {
        // Remember the last entry from the list of param names that keeps
        // growing during parsing as the name of the current node.
        current.paramKey = parameters.getLastKey()
      }
      break
    }
  }

  find(path, paramValues = []) {
    const { prefix } = this
    if (!path || path === prefix) {
      // It's a match!
      const { handler } = this
      if (handler) {
        const params = this.parameters.getObject(paramValues)
        // Support HTTP status on found entries.
        return { handler, params, status: 200 }
      }
      return null
    }

    const pos = getCommonOffset(this.prefix, path)
    const prefixLength = prefix.length
    const fullMatch = pos === prefixLength
    if (fullMatch) {
      path = path.slice(prefixLength)
    } else if (this.type !== TYPE_PARAM && this.type !== TYPE_PLACEHOLDER) {
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
      const result = staticChild.find(path, paramValues)
      if (result) {
        return result
      }
    }

    // Node not found
    if (!fullMatch) return null

    // Param / placeholder node
    const paramChild = this.children.find(
      child => child.type === TYPE_PARAM || child.type === TYPE_PLACEHOLDER
    )
    if (paramChild) {
      // Find the position of the next slash:
      let pos = 0
      const max = path.length
      while (pos < max && path[pos] !== CHAR_SLASH) {
        pos++
      }
      paramValues.push(path.slice(0, pos))
      const result = paramChild.find(path.slice(pos), paramValues)
      if (result) {
        return result
      }
      paramValues.pop()
    }

    // Match-any nodes
    if (this.hasMatchAny) {
      for (const child of this.children) {
        const match = child.parameters?.matchPathPattern(path)
        if (match) {
          paramValues.push(...Object.values(match.groups))
          return child.find('', paramValues) // '' == End
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
          ? `${this.prefix}${this.paramKey}`
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
    this.matchAnyIndex = 0
    this.placeholderIndex = 0
  }

  add(...keys) {
    this.keys.push(...keys)
  }

  getMatchAnyKey() {
    return `$$${this.matchAnyIndex++}`
  }

  getPlaceholderKey() {
    return `$${this.placeholderIndex++}`
  }

  getLastKey() {
    return this.keys[this.keys.length - 1]
  }

  matchPathPattern(path) {
    return this.pathPattern?.exec(path)
  }

  setupPathPattern(path) {
    // Replace all '**' with '.+?' and all '*' with '[^/]+'.
    // Use named groups to merge multiple ** or * into one.
    const pattern = []
    const keys = []
    for (const token of path.split('/')) {
      if (token === '**') {
        const key = this.getMatchAnyKey()
        pattern.push(`(?<${key}>.+?)`)
        keys.push(key)
      } else if (token === '*') {
        const key = this.getPlaceholderKey()
        pattern.push(`(?<${key}>[^/]+)`)
        keys.push(key)
      } else if (token.startsWith(':')) {
        const key = token.slice(1)
        pattern.push(`(?<${key}>[^/]+)`)
        keys.push(key)
      } else {
        pattern.push(token)
      }
    }
    this.pathPattern = new RegExp(`^${pattern.join('/')}$`)
    this.add(...keys)
  }

  getObject(values) {
    // Convert parameters and values to a params object, but rename path pattern
    // groups back to param names
    const params = {}
    let i = 0
    for (const key of this.keys) {
      const name = key.startsWith('$$')
        ? this.matchAnyIndex === 1
          ? '$$'
          : key
        : key.startsWith('$')
          ? this.placeholderIndex === 1
            ? '$'
            : key
          : key
      params[name] = values[i++]
    }
    return params
  }
}
