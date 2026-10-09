import { vi } from 'vitest'
import DitoContext from '../DitoContext.js'
import { mountForm } from '../test/mount.js'

describe('DitoSchema', () => {
  it('passes the context to `schema.data()`', async () => {
    const data = vi.fn(() => ({ isPreviewing: false }))
    const { schemaComponent } = await mountForm({
      schema: {
        data,
        components: { title: { type: 'text' } }
      },
      data: { title: 'Emma' }
    })
    const [context] = data.mock.calls[0]
    expect(context).toBeInstanceOf(DitoContext)
    expect(context.item).toMatchObject({ title: 'Emma' })
    expect(schemaComponent.isPreviewing).toBe(false)
  })
})
