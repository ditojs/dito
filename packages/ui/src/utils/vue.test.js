import { h, createCommentVNode, isReactive, reactive } from 'vue'
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
})

describe('raw()', () => {
  it('wraps values in objects that never become reactive', () => {
    const wrapped = raw({ title: 'Orlando' })
    expect(wrapped.value).toEqual({ title: 'Orlando' })
    expect(isReactive(reactive({ wrapped }).wrapped)).toBe(false)
  })
})
