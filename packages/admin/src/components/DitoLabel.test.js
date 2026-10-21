import { vi } from 'vitest'
import { html } from '@ditojs/utils'
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

  it('renders the HTML of `html` labels', async () => {
    const label = await mountLabel(html`<b>Title</b> &amp; ${'<more>'}`)
    expect(label.find('label b').text()).toBe('Title')
    expect(label.find('label').text()).toBe('Title & <more>')
  })

  it('renders the HTML of deprecated `{ html }` labels, with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const label = await mountLabel({ html: '<b>Title</b> &amp; more' })
    expect(label.find('label b').text()).toBe('Title')
    expect(label.find('label').text()).toBe('Title & more')
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('`{ html }` is deprecated')
    )
    warn.mockRestore()
  })

  it('renders the HTML of `html` labels with affixes', async () => {
    const label = await mountLabel({ text: html`<b>Q</b>`, prefix: '1.' })
    expect(label.find('label b').text()).toBe('Q')
    expect(label.find('.dito-affix').text()).toBe('1.')
  })

  it('shows info as text, and `html` info as HTML', async () => {
    const { findContainer } = await mountSchema({
      schema: {
        fields: {
          title: { type: 'text', info: 'Q & <b>A</b>' },
          author: { type: 'text', info: html`<b>${'Q & A'}</b>` }
        }
      }
    })
    const getInfo = name =>
      findContainer(name).find('.dito-info').attributes('data-info')
    expect(getInfo('title')).toBe('Q &amp; &lt;b&gt;A&lt;/b&gt;')
    expect(getInfo('author')).toBe('<b>Q &amp; A</b>')
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
