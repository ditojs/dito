import { afterEach, vi } from 'vitest'
import { html } from '@ditojs/utils'
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
  afterEach(() => vi.restoreAllMocks())

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

  it('renders strings with HTML as text', () => {
    const wrapper = mountAffixes({
      items: ['<img src=x onerror="alert(1)">', { text: '<b>New</b>' }]
    })
    expect(wrapper.find('img, b').exists()).toBe(false)
    expect(wrapper.findAll('.dito-affix').map(affix => affix.text())).toEqual(
      ['<img src=x onerror="alert(1)">', '<b>New</b>']
    )
  })

  it('renders `html` as HTML, also as `text`', () => {
    const wrapper = mountAffixes({
      items: [html`<b>${'New'}</b>`, { text: html`<i>Sale</i>`, as: 'span' }]
    })
    expect(wrapper.find('.dito-affix--text b').text()).toBe('New')
    expect(wrapper.find('span.dito-affix--text i').text()).toBe('Sale')
  })

  it('renders items with a `type` as they are', () => {
    const wrapper = mountAffixes({
      items: [
        { type: 'text', text: html`<i>Sale</i>`, as: 'span' },
        { type: 'component', component: () => h('em', 'Custom') }
      ]
    })
    expect(wrapper.find('span.dito-affix--text i').text()).toBe('Sale')
    expect(wrapper.find('.dito-affix--component').text()).toBe('Custom')
  })

  it(`renders nothing for items without type or text`, () => {
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

  it('marks the affixes with a hover affix, which hides the others', async () => {
    const wrapper = mountAffixes({ items: ['EUR'], clearable: true })
    expect(wrapper.classes()).not.toContain('dito-affixes--hover')
    // The clear button is a hover affix:
    await wrapper.setProps({ hasValue: true })
    expect(wrapper.classes()).toContain('dito-affixes--hover')
  })

  it('renders the content of its slots', () => {
    const wrapper = mount(DitoAffixes, {
      props: { parentContext: {} },
      slots: { append: () => h('span', 'Unit') }
    })
    expect(wrapper.find('.dito-affixes').text()).toBe('Unit')
  })
})
