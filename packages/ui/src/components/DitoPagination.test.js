import { mount } from '@vue/test-utils'
import DitoPagination from './DitoPagination.vue'

describe('DitoPagination', () => {
  it(`doesn't submit forms with its buttons`, async () => {
    const wrapper = mount(DitoPagination, {
      props: { total: 30, page: 1, pageSize: 10 }
    })
    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBeGreaterThan(0)
    expect(buttons.map(button => button.attributes('type'))).toEqual(
      buttons.map(() => 'button')
    )
  })
})
