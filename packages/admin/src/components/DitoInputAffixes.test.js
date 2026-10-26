import { afterEach } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import DitoInputAffixes from './DitoInputAffixes.vue'
import { mountSchema } from '../test/mount.js'

// Mounts the affixes on their own, without a type component.
function mountInputAffixes(props) {
  return mount(DitoInputAffixes, {
    props: { parentContext: {}, ...props }
  })
}

describe('DitoInputAffixes', () => {
  enableAutoUnmount(afterEach)

  it('renders the items at its position', () => {
    const wrapper = mountInputAffixes({
      position: 'prefix',
      items: ['From']
    })
    expect(wrapper.classes()).toContain('dito-affixes--prefix')
    expect(wrapper.text()).toBe('From')
  })

  it('emits `clear` from its clear button', () => {
    const wrapper = mountInputAffixes({
      position: 'suffix',
      clearable: true,
      hasValue: true
    })
    wrapper.find('button[title="Clear"]').trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  it('only shows the clear button of clearable values that are set', () => {
    const hasClearButton = props =>
      mountInputAffixes({ position: 'suffix', ...props })
        .find('button[title="Clear"]')
        .exists()
    expect(hasClearButton({ clearable: true, hasValue: true })).toBe(true)
    expect(hasClearButton({ clearable: true, hasValue: false })).toBe(false)
    expect(hasClearButton({ clearable: false, hasValue: true })).toBe(false)
  })

  it('renders the inline info', () => {
    const wrapper = mountInputAffixes({
      position: 'suffix',
      inlineInfo: 'Help'
    })
    expect(wrapper.find('.dito-info').attributes('data-info')).toBe('Help')
  })

  it('is only mounted by fields with affixes to show', async () => {
    const { wrapper } = await mountSchema({
      schema: {
        fields: {
          title: { type: 'text' },
          price: { type: 'number', prefix: '$' },
          author: { type: 'text', clearable: true },
          isbn: { type: 'text', label: false, info: 'Help' }
        }
      },
      data: { author: 'Ada' }
    })
    expect(
      wrapper
        .findAllComponents(DitoInputAffixes)
        .map(affixes => affixes.props('position'))
    ).toEqual(['prefix', 'suffix', 'suffix'])
  })
})
