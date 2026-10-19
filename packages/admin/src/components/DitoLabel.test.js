import { mountSchema } from '../test/mount.js'

async function mountLabel(label, data = {}) {
  const { findContainer } = await mountSchema({
    schema: { fields: { title: { type: 'text', label } } },
    data
  })
  return findContainer('title').find('.dito-label')
}

describe('DitoLabel', () => {
  it('shows text labels as text', async () => {
    const label = await mountLabel('Tom & Jerry <b>')
    expect(label.find('label').text()).toBe('Tom & Jerry <b>')
    expect(label.find('b').exists()).toBe(false)
  })

  it('renders the HTML of `{ html }` labels', async () => {
    const label = await mountLabel({ html: '<b>Title</b> &amp; more' })
    expect(label.find('label b').text()).toBe('Title')
    expect(label.find('label').text()).toBe('Title & more')
  })

  it('shows the text of labels with affixes as text', async () => {
    const label = await mountLabel({ text: 'Q & <b>A</b>', prefix: '1.' })
    expect(label.find('label').text()).toBe('Q & <b>A</b>')
    expect(label.find('.dito-affix').text()).toBe('1.')
  })

  it('shows the values of label components as text', async () => {
    const { findContainer } = await mountSchema({
      schema: { fields: { note: { type: 'label' } } },
      data: { note: 'Draft & <b>proof</b>' }
    })
    const label = findContainer('note').find('.dito-label')
    expect(label.text()).toBe('Draft & <b>proof</b>')
    expect(label.find('b').exists()).toBe(false)
  })
})
