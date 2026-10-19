import { mount } from '@vue/test-utils'
import DitoProgress from './DitoProgress.vue'

describe('DitoProgress', () => {
  it('renders a native `<progress>` element', () => {
    const progress = mount(DitoProgress, { props: { value: 0.25 } })
    expect(progress.element.tagName).toBe('PROGRESS')
    expect(progress.classes()).toEqual(['dito-progress'])
    expect(progress.element.value).toBe(0.25)
    expect(progress.element.max).toBe(1)
    expect(progress.element.position).toBe(0.25)
  })

  it('shows the value between `min` and `max`', async () => {
    const progress = mount(DitoProgress, {
      props: { value: 30, min: 20, max: 70 }
    })
    expect(progress.attributes('value')).toBe('10')
    expect(progress.attributes('max')).toBe('50')
    expect(progress.element.position).toBe(0.2)
    await progress.setProps({ value: 70 })
    expect(progress.element.position).toBe(1)
  })

  it('is indeterminate without a value', async () => {
    const progress = mount(DitoProgress, { props: { max: 100 } })
    expect(progress.attributes('value')).toBeUndefined()
    expect(progress.element.position).toBe(-1)
    await progress.setProps({ value: 50 })
    expect(progress.element.position).toBe(0.5)
    await progress.setProps({ value: null })
    expect(progress.attributes('value')).toBeUndefined()
    expect(progress.element.position).toBe(-1)
  })

  it('passes attributes to the progress element', () => {
    const progress = mount(DitoProgress, {
      props: { value: 0.5 },
      attrs: { 'id': 'export-progress', 'aria-label': 'Export' }
    })
    expect(progress.attributes()).toMatchObject({
      'id': 'export-progress',
      'aria-label': 'Export'
    })
  })
})
