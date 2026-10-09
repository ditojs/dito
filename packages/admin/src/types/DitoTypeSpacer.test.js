import { mountForm } from '../test/mount.js'

describe('DitoTypeSpacer', () => {
  it(`doesn't generate a label from its name`, async () => {
    const { wrapper } = await mountForm({
      schema: {
        components: {
          title: { type: 'text' },
          gap: { type: 'spacer' }
        }
      }
    })
    const labels = wrapper.findAll('.dito-container .dito-label')
    expect(labels.map(label => label.text())).toEqual(['Title'])
  })

  it(`doesn't add a value to new items`, async () => {
    const { data } = await mountForm({
      schema: {
        components: {
          title: { type: 'text' },
          gap: { type: 'spacer' }
        }
      }
    })
    expect(data).toEqual({ title: null })
  })

  it(`doesn't send a value`, async () => {
    const { submit } = await mountForm({
      schema: {
        components: {
          title: { type: 'text' },
          gap: { type: 'spacer' }
        }
      },
      data: { title: 'Emma' },
      request: ({ data }) => ({ data })
    })
    expect(await submit()).toEqual({ id: 1, title: 'Emma' })
  })
})
