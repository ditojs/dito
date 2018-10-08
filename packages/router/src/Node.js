// Special Labels:
const PARAM = ':'
const MATCH_ANY = '*'

export default class Node {
  constructor(...args) {
    this.initialize(...args)
  }

  initialize(
    prefix = '/',
    children = {},
    handler = null,
    paramNames = null
  ) {
    this.label = prefix[0]
    this.prefix = prefix
    this.children = children
    this.handler = handler
    this.paramNames = paramNames
    this.paramName = null
  }

  addChild(child) {
    // No two children can have the same label in a prefix-tree so this is fine:
    this.children[child.label] = child
  }

  findChild(label) {
    return this.children[label]
  }

  add(path, handler) {
    const paramNames = []
    for (let pos = 0, length = path.length; pos < length; pos++) {
      const ch = path[pos]
      if (ch === PARAM) {
        this.insert(path.substring(0, pos))
        pos++ // Skip colon.
        const start = pos
        // Move pos to the next occurrence of the slash or the end:
        pos += path.substring(pos).match(/^([^/]*)/)[1].length

        paramNames.push(path.substring(start, pos))
        // Chop out param name from path, but keep colon.
        path = path.substring(0, start) + path.substring(pos)
        length = path.length // Update length after changing path.

        if (start === length) {
          return this.insert(path, paramNames, handler)
        }
        pos = start
        // We need to include paramNames here for toString() and nested queries.
        this.insert(path.substring(0, pos), paramNames)
      } else if (ch === MATCH_ANY) {
        this.insert(path.substring(0, pos))
        paramNames.push(MATCH_ANY)
        return this.insert(path, paramNames, handler)
      }
    }
    this.insert(path, paramNames, handler)
  }

  insert(path, paramNames, handler) {
    let current = this
    while (true) {
      // Find the position where the path and the node's prefix start diverging
      const { prefix } = current
      let pos = 0
      const max = path.length < prefix.length ? path.length : prefix.length
      while (pos < max && path[pos] === prefix[pos]) {
        pos++
      }
      if (pos < prefix.length) {
        // Split node
        const node = new Node(
          prefix.substring(pos),
          current.children,
          current.handler,
          current.paramNames
        )
        // Reset parent node and add new node as child to it:
        current.initialize(prefix.substring(0, pos))
        current.addChild(node)
        if (pos < path.length) {
          // Create child node
          const node = new Node(path.substring(pos))
          current.addChild(node)
          current = node // Switch to child to set handler
        }
      } else if (pos < path.length) {
        path = path.substring(pos)
        const child = current.findChild(path[0])
        if (child !== undefined) {
          // Go deeper
          current = child
          continue
        }
        // Create child node
        const node = new Node(path)
        current.addChild(node)
        current = node // Switch to child to set handler
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
    if (!path || path === this.prefix) {
      // It's a match!
      const { handler, paramNames } = this
      if (handler) {
        // Convert paramNames and values to params
        const params = {}
        let i = 0
        for (const name of paramNames) {
          params[name] = paramValues[i++]
        }
        return { handler, params }
      }
      return null
    }

    const fullMatch = path.startsWith(this.prefix)
    if (fullMatch) {
      path = path.substring(this.prefix.length)
    } else if (this.label !== PARAM) {
      // If the path doesn't fully match the prefix, we only need to look
      // further on param nodes, which can have overlapping static children.
      return null
    }

    // Search order: Static > Param > Match-any

    // Static node
    const staticChild = this.findChild(path[0])
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
    const paramChild = this.findChild(PARAM)
    if (paramChild) {
      // Find the position of the next slash:
      const pos = path.match(/^([^/]*)/)[1].length
      paramValues.push(path.substring(0, pos))
      const result = paramChild.find(path.substring(pos), paramValues)
      if (result) {
        return result
      }
      paramValues.pop()
    }

    // Match-any node
    const matchAnyChild = this.findChild(MATCH_ANY)
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
    const children = Object.values(this.children)
    const lines = [
      `${format(prefix, tail, '└── ', '├── ')}${
        this.label === PARAM
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
