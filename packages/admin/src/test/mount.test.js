import { html } from '@ditojs/utils'
import { mountSchema, mountForm, mountAdmin, stubConfirm } from './mount.js'
import { confirm } from '../utils/dialogs.js'

describe('mountSchema()', () => {
  it('renders the components of the schema with the data', async () => {
    const { wrapper, data } = await mountSchema({
      schema: { fields: { title: { type: 'text' } } },
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
      schema: { fields: { title: { type: 'text' } } },
      data: { title: 'Dune' }
    })
    expect(data.title).toBe('Dune')
    expect(wrapper.find('input').element.value).toBe('Dune')
  })
})

describe('stubConfirm()', () => {
  it('answers the confirmation dialogs with the mock', async () => {
    const answer = stubConfirm(false)
    const { root } = await mountAdmin({ views: {} })
    const ask = () => confirm(root, html`Delete <b>Dune</b>?`)
    expect(await ask()).toBe(false)
    answer.mockReturnValue(true)
    expect(await ask()).toBe(true)
    expect(answer).toHaveBeenCalledWith('Delete Dune?')
  })
})
