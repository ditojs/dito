import { html } from '@ditojs/utils'
import { mountForm } from '../test/mount.js'

describe('DitoTabs', () => {
  it('shows the labels of tabs as text', async () => {
    const { wrapper } = await mountForm({
      schema: {
        tabs: {
          details: {
            type: 'tab',
            label: 'Q & A <i>',
            fields: { title: { type: 'text' } }
          },
          notes: {
            type: 'tab',
            label: html`<b>Notes</b>`,
            fields: { notes: { type: 'text' } }
          }
        }
      },
      data: {}
    })
    const links = wrapper.findAll('.dito-tabs__link')
    expect(links.map(link => link.text())).toEqual(['Q & A <i>', 'Notes'])
    expect(wrapper.find('.dito-tabs b, .dito-tabs i').exists()).toBe(false)
  })
  it(`keeps Space on a tab from scrolling the pane`, async () => {
    const { wrapper } = await mountForm({
      schema: {
        tabs: {
          details: { type: 'tab', fields: { title: { type: 'text' } } },
          notes: { type: 'tab', fields: { notes: { type: 'text' } } }
        }
      },
      data: {}
    })
    const event = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      cancelable: true
    })
    wrapper.find('.dito-tabs__link').element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })
})
