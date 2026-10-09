import { mountForm } from '../test/mount.js'

const schema = {
  tabs: {
    details: {
      type: 'tab',
      label: 'Details',
      components: { title: { type: 'text' } }
    },
    notes: {
      type: 'tab',
      label: 'Notes',
      components: { notes: { type: 'text' } }
    },
    history: {
      type: 'tab',
      label: 'History',
      components: { year: { type: 'number' } }
    }
  }
}

function getSelectedTab(wrapper) {
  return wrapper.find('.dito-tabs__link[aria-selected="true"]').text()
}

describe('DitoTabs', () => {
  it('moves the focus with the arrow keys, Home and End', async () => {
    const { wrapper, settle } = await mountForm({ schema, data: {} })
    const getLink = label =>
      wrapper.findAll('.dito-tabs__link').find(link => link.text() === label)
    const expectFocused = label =>
      expect(document.activeElement).toBe(getLink(label).element)
    expect(getSelectedTab(wrapper)).toBe('Details')

    await getLink('Details').trigger('keydown', { key: 'ArrowRight' })
    expectFocused('Notes')
    await getLink('Notes').trigger('keydown', { key: 'End' })
    expectFocused('History')
    await getLink('History').trigger('keydown', { key: 'ArrowRight' })
    expectFocused('Details')
    await getLink('Details').trigger('keydown', { key: 'ArrowLeft' })
    expectFocused('History')
    await getLink('History').trigger('keydown', { key: 'Home' })
    expectFocused('Details')
    await settle()
    // Moving the focus doesn't select tabs:
    expect(getSelectedTab(wrapper)).toBe('Details')
  })

  it('selects the focused tab with Enter and Space', async () => {
    const { wrapper, settle } = await mountForm({ schema, data: {} })
    const getLink = label =>
      wrapper.findAll('.dito-tabs__link').find(link => link.text() === label)

    await getLink('Notes').trigger('keydown', { key: 'Enter' })
    await settle()
    expect(getSelectedTab(wrapper)).toBe('Notes')
    expect(getLink('Notes').attributes('tabindex')).toBe('0')

    await getLink('History').trigger('keydown', { key: ' ' })
    await settle()
    expect(getSelectedTab(wrapper)).toBe('History')
  })

  it('moves the focus to tabs that render after mounting', async () => {
    const { wrapper, data, settle } = await mountForm({
      schema: {
        tabs: {
          ...schema.tabs,
          notes: {
            ...schema.tabs.notes,
            if: ({ item }) => item.title === 'Dune'
          }
        }
      },
      data: { title: 'Emma' }
    })
    const getLink = label =>
      wrapper.findAll('.dito-tabs__link').find(link => link.text() === label)
    const expectFocused = label =>
      expect(document.activeElement).toBe(getLink(label).element)
    expect(getLink('Notes')).toBeUndefined()

    data.title = 'Dune'
    await settle()
    await getLink('Details').trigger('keydown', { key: 'ArrowRight' })
    expectFocused('Notes')
    await getLink('Notes').trigger('keydown', { key: 'End' })
    expectFocused('History')
  })
})
