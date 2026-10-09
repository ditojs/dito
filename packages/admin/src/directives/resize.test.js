import { vi } from 'vitest'
// A `ResizeObserver` stub that records its instances, so tests can trigger
// resize entries.
class ResizeObserverStub {
  static instances = []

  constructor(callback) {
    this.callback = callback
    this.nodes = new Map()
    ResizeObserverStub.instances.push(this)
  }

  observe(node, options) {
    this.nodes.set(node, options)
  }

  unobserve(node) {
    this.nodes.delete(node)
  }

  resize(node, width) {
    this.callback([
      {
        target: node,
        contentRect: { width },
        // Like in Firefox before v92, as objects instead of arrays:
        borderBoxSize: { inlineSize: width },
        contentBoxSize: [{ inlineSize: width }],
        devicePixelContentBoxSize: undefined
      }
    ])
  }
}

// The module creates its observers per `box` option lazily and checks for
// `ResizeObserver` support when imported, so import it fresh for each test.
async function importResize() {
  vi.resetModules()
  return import('./resize.js')
}

describe('resize directive', () => {
  beforeEach(() => {
    ResizeObserverStub.instances = []
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls the handlers of resized nodes with normalized events', async () => {
    const { observeResize, isResizeSupported } = await importResize()
    expect(isResizeSupported).toBe(true)
    const node = document.createElement('div')
    const handler = vi.fn()
    observeResize(node, handler)
    const [observer] = ResizeObserverStub.instances
    expect(observer.nodes.get(node)).toEqual({ box: 'content-box' })
    observer.resize(node, 100)
    expect(handler).toHaveBeenCalledWith({
      target: node,
      contentRect: { width: 100 },
      borderBoxSize: [{ inlineSize: 100 }],
      contentBoxSize: [{ inlineSize: 100 }],
      devicePixelContentBoxSize: []
    })
  })

  it('calls all handlers of a node, but not those of other nodes', async () => {
    const { observeResize } = await importResize()
    const node = document.createElement('div')
    const otherNode = document.createElement('div')
    const handlers = [vi.fn(), vi.fn(), vi.fn()]
    observeResize(node, handlers[0])
    observeResize(node, handlers[1])
    observeResize(otherNode, handlers[2])
    const [observer] = ResizeObserverStub.instances
    observer.resize(node, 100)
    expect(handlers[0]).toHaveBeenCalledOnce()
    expect(handlers[1]).toHaveBeenCalledOnce()
    expect(handlers[2]).not.toHaveBeenCalled()
  })

  it('shares one observer per `box` option', async () => {
    const { observeResize } = await importResize()
    const node = document.createElement('div')
    observeResize(node, vi.fn())
    observeResize(document.createElement('div'), vi.fn())
    observeResize(node, vi.fn(), { box: 'border-box' })
    expect(ResizeObserverStub.instances).toHaveLength(2)
    expect(ResizeObserverStub.instances[1].nodes.get(node)).toEqual({
      box: 'border-box'
    })
  })

  it('stops observing nodes once their last handler is removed', async () => {
    const { observeResize, unobserveResize } = await importResize()
    const node = document.createElement('div')
    const [first, second] = [vi.fn(), vi.fn()]
    observeResize(node, first)
    observeResize(node, second)
    const [observer] = ResizeObserverStub.instances
    unobserveResize(node, first)
    expect(observer.nodes.has(node)).toBe(true)
    observer.resize(node, 50)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledOnce()
    unobserveResize(node, second)
    expect(observer.nodes.has(node)).toBe(false)
  })

  it('ignores the removal of unknown handlers', async () => {
    const { observeResize, unobserveResize } = await importResize()
    const node = document.createElement('div')
    observeResize(node, vi.fn())
    unobserveResize(node, vi.fn())
    unobserveResize(document.createElement('div'), vi.fn())
    expect(ResizeObserverStub.instances[0].nodes.has(node)).toBe(true)
  })

  it('creates a new observer after the last node was removed', async () => {
    const { observeResize, unobserveResize } = await importResize()
    const node = document.createElement('div')
    const handler = vi.fn()
    observeResize(node, handler)
    unobserveResize(node, handler)
    observeResize(node, handler)
    expect(ResizeObserverStub.instances).toHaveLength(2)
  })

  it('keeps the observer while other nodes are still observed', async () => {
    const { observeResize, unobserveResize } = await importResize()
    const [node, otherNode] = [
      document.createElement('div'),
      document.createElement('div')
    ]
    const handler = vi.fn()
    observeResize(node, handler)
    observeResize(otherNode, handler)
    unobserveResize(node, handler)
    observeResize(node, handler)
    expect(ResizeObserverStub.instances).toHaveLength(1)
  })

  it('ignores entries of nodes that were unobserved meanwhile', async () => {
    // `ResizeObserver` may still deliver entries that were queued before the
    // node was unobserved.
    const { observeResize, unobserveResize } = await importResize()
    const [node, otherNode] = [
      document.createElement('div'),
      document.createElement('div')
    ]
    const [handler, otherHandler] = [vi.fn(), vi.fn()]
    observeResize(node, handler)
    observeResize(otherNode, otherHandler)
    unobserveResize(node, handler)
    const [observer] = ResizeObserverStub.instances
    expect(() => observer.resize(node, 10)).not.toThrow()
    expect(handler).not.toHaveBeenCalled()
    expect(otherHandler).not.toHaveBeenCalled()
  })

  it('observes and unobserves through the directive hooks', async () => {
    const { default: resize } = await importResize()
    const node = document.createElement('div')
    const binding = { value: vi.fn(), arg: undefined }
    resize.mounted(node, binding)
    const [observer] = ResizeObserverStub.instances
    observer.resize(node, 10)
    expect(binding.value).toHaveBeenCalledOnce()
    resize.unmounted(node, binding)
    expect(observer.nodes.has(node)).toBe(false)
  })

  it('does nothing without `ResizeObserver` support', async () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const { observeResize, unobserveResize, isResizeSupported } =
      await importResize()
    expect(isResizeSupported).toBe(false)
    const node = document.createElement('div')
    const handler = vi.fn()
    expect(() => {
      observeResize(node, handler)
      unobserveResize(node, handler)
    }).not.toThrow()
  })
})
