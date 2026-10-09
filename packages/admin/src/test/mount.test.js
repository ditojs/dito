import { mountSchema, mountForm } from './mount.js'

describe('mountSchema()', () => {
  it('renders the components of the schema with the data', async () => {
    const { wrapper, data } = await mountSchema({
      schema: { components: { title: { type: 'text' } } },
      data: { title: 'Dune' }
    })
    const input = wrapper.find('input[name="title"]')
    expect(input.element.value).toBe('Dune')
    await input.setValue('Emma')
    expect(data.title).toBe('Emma')
  })
})

describe('mountForm()', () => {
  it('loads the data of the item into the form', async () => {
    const { wrapper, data } = await mountForm({
      schema: { components: { title: { type: 'text' } } },
      data: { title: 'Dune' }
    })
    expect(data.title).toBe('Dune')
    expect(wrapper.find('input').element.value).toBe('Dune')
  })
})
