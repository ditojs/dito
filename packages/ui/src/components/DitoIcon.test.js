import { mount } from '@vue/test-utils'
import DitoIcon from './DitoIcon.vue'

describe('DitoIcon', () => {
  it('renders an icon element with the modifier of its name', () => {
    const icon = mount(DitoIcon, { props: { name: 'bookmark' } })
    expect(icon.element.tagName).toBe('I')
    expect(icon.classes()).toEqual(['dito-icon', 'dito-icon--bookmark'])
  })

  it('adds the disabled modifier', () => {
    const icon = mount(DitoIcon, { props: { name: 'trash', disabled: true } })
    expect(icon.classes()).toEqual([
      'dito-icon',
      'dito-icon--trash',
      'dito-icon--disabled'
    ])
  })

  it('updates its classes when the name changes', async () => {
    const icon = mount(DitoIcon, { props: { name: 'add' } })
    await icon.setProps({ name: 'remove' })
    expect(icon.classes()).toEqual(['dito-icon', 'dito-icon--remove'])
  })
})
