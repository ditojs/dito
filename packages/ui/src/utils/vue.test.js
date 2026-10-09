import { h, createCommentVNode, isReactive, reactive } from 'vue'
import { mount } from '@vue/test-utils'
import { hasVNodeContent, hasSlotContent, raw } from './vue.js'

describe('hasVNodeContent()', () => {
  it('detects vnodes other than comments', () => {
    expect(hasVNodeContent(h('div'))).toBe(true)
    expect(hasVNodeContent([createCommentVNode('v-if'), h('span')])).toBe(true)
  })

  it('treats comments only and missing vnodes as empty', () => {
    expect(hasVNodeContent([createCommentVNode('v-if')])).toBe(false)
    expect(hasVNodeContent([])).toBe(false)
    expect(hasVNodeContent(null)).toBeFalsy()
  })
})

describe('hasSlotContent()', () => {
  it('renders slot functions with the props to check their content', () => {
    const slot = ({ visible }) =>
      visible ? [h('span')] : [createCommentVNode('v-if')]
    expect(hasSlotContent(slot, { visible: true })).toBe(true)
    expect(hasSlotContent(slot, { visible: false })).toBe(false)
    expect(hasSlotContent(undefined)).toBeFalsy()
  })

  it(`looks up slots by name in the current component's setup`, () => {
    const Shelf = {
      setup() {
        const hasHeader = !!hasSlotContent('header')
        const hasFooter = !!hasSlotContent('footer', { count: 0 })
        return () => h('div', `${hasHeader} ${hasFooter}`)
      }
    }
    const wrapper = mount(Shelf, {
      slots: {
        header: () => h('h2', 'Novels'),
        footer: ({ count }) => (count ? h('p', count) : createCommentVNode(''))
      }
    })
    expect(wrapper.text()).toBe('true false')
    expect(mount(Shelf).text()).toBe('false false')
  })
})

describe('raw()', () => {
  it('wraps values in objects that never become reactive', () => {
    const wrapped = raw({ title: 'Orlando' })
    expect(wrapped.value).toEqual({ title: 'Orlando' })
    expect(isReactive(reactive({ wrapped }).wrapped)).toBe(false)
  })
})
