import { mount } from '@vue/test-utils'
import DitoPagination from './DitoPagination.vue'

function mountPagination(props = {}) {
  return mount(DitoPagination, { props })
}

function getTotal(wrapper) {
  return wrapper.find('.dito-pagination__total').text()
}

describe('DitoPagination', () => {
  it('shows the range of the current page and the total', () => {
    expect(getTotal(mountPagination({ total: 25, page: 3 }))).toBe(
      '21 – 25 / 25'
    )
    expect(
      getTotal(mountPagination({ total: 95, page: 2, pageSize: 20 }))
    ).toBe(
      '21 – 40 / 95'
    )
  })

  it('shows an empty total and no buttons without items', () => {
    const wrapper = mountPagination({ total: 0 })
    expect(getTotal(wrapper)).toBe('')
    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('hides the total with `showTotal: false`', () => {
    const wrapper = mountPagination({ total: 25, showTotal: false })
    expect(wrapper.find('.dito-pagination__total').exists()).toBe(false)
  })

  it('renders no buttons for a single page', () => {
    const wrapper = mountPagination({ total: 10 })
    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('emits `update:page` and updates the total on clicks', async () => {
    const wrapper = mountPagination({ total: 30, page: 1 })
    await wrapper.find('button[aria-label="Page 3"]').trigger('click')
    expect(wrapper.emitted('update:page')).toEqual([[3]])
    expect(getTotal(wrapper)).toBe('21 – 30 / 30')
  })

  it('follows changes of the page prop', async () => {
    const wrapper = mountPagination({ total: 100, page: 1 })
    await wrapper.setProps({ page: 5 })
    expect(wrapper.find('[aria-current="page"]').text()).toBe('5')
    expect(getTotal(wrapper)).toBe('41 – 50 / 100')
  })

  it('moves to the last page when a larger page size removes the current', async () => {
    const wrapper = mountPagination({ total: 100, page: 8, pageSize: 10 })
    await wrapper.setProps({ pageSize: 25 })
    expect(wrapper.emitted('update:page')).toEqual([[4]])
    expect(getTotal(wrapper)).toBe('76 – 100 / 100')
  })

  it('keeps the current page when it still exists after resizing', async () => {
    const wrapper = mountPagination({ total: 100, page: 2, pageSize: 10 })
    await wrapper.setProps({ pageSize: 20 })
    expect(wrapper.emitted('update:page')).toBeUndefined()
  })

  it('stays on page 1 when resizing without items', async () => {
    const wrapper = mountPagination({ total: 0, page: 1, pageSize: 10 })
    await wrapper.setProps({ pageSize: 20 })
    expect(wrapper.emitted('update:page')).toBeUndefined()
  })
})
