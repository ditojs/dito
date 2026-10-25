import { vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { UiRegistry } from './UiRegistry.ts'

describe('UiRegistry', () => {
  const dataContext = {}

  it('registers handles under their component path', () => {
    const registry = new UiRegistry()
    const handle = { dataContext }
    const unregister = registry.register(() => 'chapters/0', handle)
    expect(registry.getHandles('chapters/0')).toEqual([handle])
    unregister()
    expect(registry.getHandles('chapters/0')).toEqual([])
  })

  it('registers handles again when their component path changes', async () => {
    const registry = new UiRegistry()
    const handle = { dataContext }
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
    const field = { dataContext }
    const schema = { dataContext }
    registry.register(() => 'author', field)
    const unregister = registry.register(() => 'author', schema)
    unregister()
    expect(registry.getHandles('author')).toEqual([field])
  })

  it('returns the handles of one data context', () => {
    const registry = new UiRegistry()
    const handle = { dataContext }
    registry.register(() => 'title', handle)
    registry.register(() => 'title', { dataContext: {} })
    expect(registry.getHandles('title', dataContext)).toEqual([handle])
  })

  it('reveals components from the outside in, and focuses them', async () => {
    const registry = new UiRegistry()
    const calls = []
    const createSchema = name => ({
      dataContext,
      reveal: async (componentPath, { focus }) => {
        calls.push([name, componentPath, focus])
      }
    })
    registry.register(() => 'main/chapters/0', createSchema('item'))
    registry.register(() => '', createSchema('root'))
    // Handles of other containers aren't asked:
    registry.register(() => 'main', { dataContext: {}, reveal: vi.fn() })
    const focus = vi.fn()
    registry.register(() => 'main/chapters/0/title', { dataContext, focus })
    await registry.reveal(dataContext, 'main/chapters/0/title', { focus: true })
    expect(calls).toEqual([
      ['root', 'main/chapters/0/title', true],
      ['item', 'main/chapters/0/title', true]
    ])
    expect(focus).toHaveBeenCalledOnce()
  })

  it('focuses the component of the value of paths inside it', async () => {
    const registry = new UiRegistry()
    const focus = vi.fn()
    registry.register(() => 'address', { dataContext, focus })
    await registry.reveal(dataContext, 'address/street', { focus: true })
    expect(focus).toHaveBeenCalledOnce()
  })

  it(`doesn't focus components when only revealing them`, async () => {
    const registry = new UiRegistry()
    const focus = vi.fn()
    registry.register(() => 'title', { dataContext, focus })
    await registry.reveal(dataContext, 'title')
    expect(focus).not.toHaveBeenCalled()
  })
})
