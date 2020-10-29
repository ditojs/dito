import { getCommonOffset } from '@ditojs/utils'

// Node Types:
const TYPE_STATIC = 0
const TYPE_PARAM = 1
const TYPE_MATCH_ANY = 2

// Char Codes
const CHAR_PARAM = ':'.charCodeAt(0)
const CHAR_MATCH_ANY = '*'.charCodeAt(0)
const CHAR_SLASH = '/'.charCodeAt(0)

export default class Node {
  constructor(...args) {
    this.initialize(...args)
  }

  initialize(
    prefix = '/',
    type = TYPE_STATIC,
    children = [],
    handler = null,
    paramNames = null
  ) {
    this.label = prefix.charCodeAt(0)
    this.prefix = prefix
    this.type = type
    this.children = children
    this.handler = handler
    this.paramNames = paramNames
    this.paramName = null
  }

  addChild(child) {
    this.children.push(child)
  }

  findChild(label, type) {
    for (const child of this.children) {
      if (child.label === label && child.type === type) {
        return child
      }
    }
  }

  findChildWithLabel(label) {
    for (const child of this.children) {
      if (child.label === label) {
        return child
      }
    }
  }

  findChildWithType(type) {
    for (const child of this.children) {
      if (child.type === type) {
        return child
      }
    }
  }

  add(path, handler) {
    const paramNames = []
    for (let pos = 0, length = path.length; pos < length; pos++) {
      const ch = path.charCodeAt(pos)
      if (ch === CHAR_PARAM) {
        this.insert(path.slice(0, pos), TYPE_STATIC)
        pos++ // Skip colon.
        const start = pos
        // Move pos to the next occurrence of the slash or the end:
        pos += path.slice(pos).match(/^([^/]*)/)[1].length

        paramNames.push(path.slice(start, pos))
        // Chop out param name from path, but keep colon.
        path = path.slice(0, start) + path.slice(pos)
        length = path.length // Update length after changing path.

        if (start === length) {
          return this.insert(path, TYPE_PARAM, paramNames, handler)
        }
        pos = start
        this.insert(path.slice(0, pos), TYPE_PARAM, paramNames)
      } else if (ch === CHAR_MATCH_ANY) {
        this.insert(path.slice(0, pos), TYPE_STATIC)
        paramNames.push('*')
        return this.insert(path, TYPE_MATCH_ANY, paramNames, handler)
      }
    }
    this.insert(path, TYPE_STATIC, paramNames, handler)
  }

  insert(path, type, paramNames, handler) {
    let current = this
    while (true) {
      // Find the position where the path and the node's prefix start diverging.
      const pos = getCommonOffset(current.prefix, path)
      const { prefix } = current
      if (pos < prefix.length) {
        // Split node
        const node = new Node(
          prefix.slice(pos),
          current.type,
          current.children,
          current.handler,
          current.paramNames
        )
        // Reset parent node and add new node as child to it:
        current.initialize(prefix.slice(0, pos))
        current.addChild(node)
        if (pos < path.length) {
          // Create child node
          const node = new Node(path.slice(pos), type)
          current.addChild(node)
          current = node // Switch to child to set handler and paramNames
        }
      } else if (pos < path.length) {
        path = path.slice(pos)
        const child = current.findChildWithLabel(path.charCodeAt(0))
        if (child !== undefined) {
          // Go deeper
          current = child
          continue
        }
        // Create child node
        const node = new Node(path, type)
        current.addChild(node)
        current = node // Switch to child to set handler and paramNames
      }
      if (handler) {
        current.handler = handler
        current.paramNames = paramNames
      }
      if (paramNames) {
        // Remember the last entry from the list of param names that keeps
        // growing during parsing as the name of the current node.
        current.paramName = paramNames[paramNames.length - 1]
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
        // Convert paramNames and values to params.
        const params = {}
        let i = 0
        for (const name of this.paramNames) {
          params[name] = paramValues[i++]
        }
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
    } else if (this.type !== TYPE_PARAM) {
      // If the path doesn't fully match the prefix, we only need to look
      // further on param nodes, which can have overlapping static children.
      return null
    }

    // Search order: Static > Param > Match-any

    // Static node
    const staticChild = this.findChild(path.charCodeAt(0), TYPE_STATIC)
    if (staticChild) {
      const result = staticChild.find(path, paramValues)
      if (result) {
        return result
      }
    }

    // Node not found
    if (!fullMatch) {
      return null
    }

    // Param node
    const paramChild = this.findChildWithType(TYPE_PARAM)
    if (paramChild) {
      // Find the position of the next slash:
      let pos = 0
      const max = path.length
      while (pos < max && path.charCodeAt(pos) !== CHAR_SLASH) {
        pos++
      }
      paramValues.push(path.slice(0, pos))
      const result = paramChild.find(path.slice(pos), paramValues)
      if (result) {
        return result
      }
      paramValues.pop()
    }

    // Match-any node
    const matchAnyChild = this.findChildWithType(TYPE_MATCH_ANY)
    if (matchAnyChild) {
      paramValues.push(path)
      return matchAnyChild.find('', paramValues) // '' == End
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
          ? `${this.prefix}${this.paramName}`
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
