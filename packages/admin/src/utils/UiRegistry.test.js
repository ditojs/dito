import { vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { UiRegistry } from './UiRegistry.ts'

describe('UiRegistry', () => {
  const container = {}

  it('registers handles under their component path', () => {
    const registry = new UiRegistry()
    const handle = { container }
    const unregister = registry.register(() => 'chapters/0', handle)
    expect(registry.getHandles('chapters/0')).toEqual([handle])
    unregister()
    expect(registry.getHandles('chapters/0')).toEqual([])
  })

  it('registers handles again when their component path changes', async () => {
    const registry = new UiRegistry()
    const handle = { container }
    const componentPath = ref('chapters/0')
    const unregister = registry.register(() => componentPath.value, handle)
    componentPath.value = 'chapters/1'
    await nextTick()
    expect(registry.getHandles('chapters/0')).toEqual([])
    expect(registry.getHandles('chapters/1')).toEqual([handle])
    unregister()
    expect(registry.getHandles('chapters/1')).toEqual([])
  })

  it('keeps the handles of the same path, e.g. of an object and its schema', () => {
    const registry = new UiRegistry()
    const field = { container }
    const schema = { container }
    registry.register(() => 'author', field)
    const unregister = registry.register(() => 'author', schema)
    unregister()
    expect(registry.getHandles('author')).toEqual([field])
  })

  it('returns the handles of one container', () => {
    const registry = new UiRegistry()
    const handle = { container }
    registry.register(() => 'title', handle)
    registry.register(() => 'title', { container: {} })
    expect(registry.getHandles('title', container)).toEqual([handle])
  })

  it('reveals components from the outside in, and focuses them', async () => {
    const registry = new UiRegistry()
    const calls = []
    const createSchema = name => ({
      container,
      reveal: async (componentPath, { focus }) => {
        calls.push([name, componentPath, focus])
      }
    })
    registry.register(() => 'main/chapters/0', createSchema('item'))
    registry.register(() => '', createSchema('root'))
    // Handles of other containers aren't asked:
    registry.register(() => 'main', { container: {}, reveal: vi.fn() })
    const focus = vi.fn()
    registry.register(() => 'main/chapters/0/title', { container, focus })
    await registry.reveal(container, 'main/chapters/0/title', { focus: true })
    expect(calls).toEqual([
      ['root', 'main/chapters/0/title', true],
      ['item', 'main/chapters/0/title', true]
    ])
    expect(focus).toHaveBeenCalledOnce()
  })

  it(`doesn't focus components when only revealing them`, async () => {
    const registry = new UiRegistry()
    const focus = vi.fn()
    registry.register(() => 'title', { container, focus })
    await registry.reveal(container, 'title')
    expect(focus).not.toHaveBeenCalled()
  })
})
