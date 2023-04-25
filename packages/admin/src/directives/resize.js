import { asArray } from '@ditojs/utils'

export default {
  mounted(node, binding) {
    observeResize(node, binding.value, binding.arg)
  },

  unmounted(node, binding) {
    unobserveResize(node, binding.value, binding.arg)
  }
}

export function observeResize(node, handler, options) {
  Observer.getObserver(options).observe(node, handler)
}

export function unobserveResize(node, handler, options) {
  Observer.getObserver(options).unobserve(node, handler)
}

export const isResizeSupported = typeof ResizeObserver !== 'undefined'

const observers = {}

class Observer {
  constructor(key, options) {
    this.key = key
    this.options = options
    this.observer = isResizeSupported
      ? new ResizeObserver(entries => this.handle(entries))
      : null
    this.handlersByNode = new WeakMap()
    this.nodeCount = 0
  }

  observe(node, handler) {
    let handlers = this.handlersByNode.get(node)
    if (!handlers) {
      handlers = new Set()
      this.handlersByNode.set(node, handlers)
      this.observer?.observe(node, this.options)
      this.nodeCount++
    }
    handlers.add(handler)
  }

  unobserve(node, handler) {
    const handlers = this.handlersByNode.get(node)
    if (handlers?.delete(handler) && handlers.size === 0) {
      this.handlersByNode.delete(node)
      this.observer?.unobserve(node)
      if (--this.nodeCount === 0) {
        delete observers[this.key]
      }
    }
  }

  handle(entries) {
    for (const entry of entries) {
      const handlers = this.handlersByNode.get(entry.target)
      if (handlers) {
        const event = {
          target: entry.target,
          contentRect: entry.contentRect,
          // Use `asArray` since Firefox before v92 returns these as objects:
          borderBoxSize: asArray(entry.borderBoxSize),
          contentBoxSize: asArray(entry.contentBoxSize),
          devicePixelContentBoxSize: asArray(entry.devicePixelContentBoxSize)
        }
        for (const handler of handlers) {
          handler(event)
        }
      }
    }
  }

  static getObserver({ box = 'content-box' } = {}) {
    const options = { box }
    const key = JSON.stringify(options)
    observers[key] ||= new Observer(key, options)
    return observers[key]
  }
}
