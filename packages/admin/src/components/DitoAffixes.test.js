import { afterEach } from 'vitest'
import { h } from 'vue'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import DitoAffixes from './DitoAffixes.vue'

function mountAffixes(props) {
  return mount(DitoAffixes, {
    props: { parentContext: {}, ...props }
  })
}

const getAffixClasses = wrapper =>
  wrapper.findAll('.dito-affix').map(affix => affix.classes())

describe('DitoAffixes', () => {
  enableAutoUnmount(afterEach)

  it('renders strings and objects with `text` as text', () => {
    const wrapper = mountAffixes({
      items: ['Price', { text: 'EUR', class: 'currency' }]
    })
    const affixes = wrapper.findAll('.dito-affix')
    expect(affixes.map(affix => affix.text())).toEqual(['Price', 'EUR'])
    expect(getAffixClasses(wrapper)).toEqual([
      ['dito-affix', 'dito-affix--text'],
      ['dito-affix', 'dito-affix--text', 'currency']
    ])
  })

  it('renders objects with `html` as HTML', () => {
    const wrapper = mountAffixes({ items: { html: '<b>New</b>' } })
    expect(wrapper.find('.dito-affix--html b').text()).toBe('New')
  })

  it('renders items with a `type` as they are', () => {
    const wrapper = mountAffixes({
      items: [
        { type: 'html', html: '<i>Sale</i>', as: 'span' },
        { type: 'component', component: () => h('em', 'Custom') }
      ]
    })
    expect(wrapper.find('span.dito-affix--html i').text()).toBe('Sale')
    expect(wrapper.find('.dito-affix--component').text()).toBe('Custom')
  })

  it(`renders nothing for items without type, text or html`, () => {
    const wrapper = mountAffixes({ items: [{ class: 'empty' }] })
    expect(wrapper.find('.dito-affixes').exists()).toBe(true)
    expect(wrapper.find('.dito-affix').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })

  it('skips empty items and the ones with a falsy `if`', () => {
    const wrapper = mountAffixes({
      items: [null, '', { text: 'Hidden', if: false }, 'Shown']
    })
    expect(wrapper.findAll('.dito-affix').map(affix => affix.text())).toEqual(
      ['Shown']
    )
  })

  it('renders nothing without content', () => {
    const wrapper = mountAffixes({ items: [{ text: 'Hidden', if: false }] })
    expect(wrapper.find('.dito-affixes').exists()).toBe(false)
  })

  it('truncates only text and HTML items in `ellipsis` mode', () => {
    const wrapper = mountAffixes({
      mode: 'ellipsis',
      position: 'suffix',
      absolute: true,
      items: ['Long text', { type: 'icon', name: 'search' }]
    })
    expect(wrapper.classes()).toEqual([
      'dito-affixes',
      'dito-affixes--suffix',
      'dito-affixes--ellipsis',
      'dito-affixes--absolute'
    ])
    const [text, icon] = getAffixClasses(wrapper)
    expect(text).toContain('dito-affix--ellipsis')
    expect(icon).toContain('dito-affix--icon')
    expect(icon).not.toContain('dito-affix--ellipsis')
  })

  it('renders the content of its slots', () => {
    const wrapper = mount(DitoAffixes, {
      props: { parentContext: {} },
      slots: { append: () => h('span', 'Unit') }
    })
    expect(wrapper.find('.dito-affixes').text()).toBe('Unit')
  })
})
