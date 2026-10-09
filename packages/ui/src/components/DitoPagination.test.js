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

function mountPagination(props = {}) {
  return mount(DitoPagination, { props })
}

// Describes the buttons as short strings: page numbers, with the active page
// in brackets, `…<` / `>…` for the ellipses and `‹` / `›` for prev / next,
// followed by `!` when disabled.
function describeButtons(wrapper) {
  return wrapper.findAll('button').map(button => {
    const classes = button.classes()
    const text = classes.includes('dito-button--prev')
      ? '‹'
      : classes.includes('dito-button--next')
        ? '›'
        : classes.includes('dito-button--ellipsis-prev')
          ? '…<'
          : classes.includes('dito-button--ellipsis-next')
            ? '>…'
            : classes.includes('dito-button--active')
              ? `[${button.text()}]`
              : button.text()
    return button.attributes('disabled') !== undefined ? `${text}!` : text
  })
}

async function clickButton(wrapper, selector) {
  await wrapper.find(selector).trigger('click')
}

function findPageButton(wrapper, page) {
  return wrapper
    .findAll('button')
    .find(button => button.attributes('aria-label') === `Page ${page}`)
}

describe('DitoPagination totals', () => {
  it('shows the range of the current page and the total', () => {
    const wrapper = mountPagination({ total: 25, page: 3, pageSize: 10 })
    expect(wrapper.find('.dito-pagination-total').text()).toBe('21 – 25 / 25')
  })

  it('shows the full range of pages before the last one', () => {
    const wrapper = mountPagination({ total: 95, page: 2, pageSize: 20 })
    expect(wrapper.find('.dito-pagination-total').text()).toBe('21 – 40 / 95')
  })

  it('shows an empty total without items', () => {
    const wrapper = mountPagination({ total: 0 })
    expect(wrapper.find('.dito-pagination-total').text()).toBe('')
    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('hides the total with `showTotal: false`', () => {
    const wrapper = mountPagination({ total: 25, showTotal: false })
    expect(wrapper.find('.dito-pagination-total').exists()).toBe(false)
  })

  it('renders no buttons for a single page', () => {
    const wrapper = mountPagination({ total: 10, pageSize: 10 })
    expect(wrapper.find('.dito-buttons').exists()).toBe(false)
  })
})

describe('DitoPagination buttons', () => {
  it('lists all pages when they fit', () => {
    expect(describeButtons(mountPagination({ total: 30, page: 1 }))).toEqual([
      '‹!',
      '[1]',
      '2',
      '3',
      '›'
    ])
  })

  it('adds the last page after a run of three pages', () => {
    expect(describeButtons(mountPagination({ total: 40, page: 2 }))).toEqual([
      '‹',
      '1',
      '[2]',
      '3',
      '4',
      '›'
    ])
  })

  it('adds an ellipsis before the last page at the start', () => {
    expect(describeButtons(mountPagination({ total: 100, page: 1 }))).toEqual(
      ['‹!', '[1]', '2', '3', '>…', '10', '›']
    )
  })

  it('surrounds the current page with ellipses in the middle', () => {
    expect(describeButtons(mountPagination({ total: 100, page: 5 }))).toEqual(
      ['‹', '1', '…<', '4', '[5]', '6', '>…', '10', '›']
    )
  })

  it('adds the first page without ellipsis next to the start', () => {
    expect(describeButtons(mountPagination({ total: 100, page: 3 }))).toEqual(
      ['‹', '1', '2', '[3]', '4', '>…', '10', '›']
    )
  })

  it('shows the last three pages at the end', () => {
    expect(
      describeButtons(mountPagination({ total: 100, page: 10 }))
    ).toEqual(['‹', '1', '…<', '8', '9', '[10]', '›!'])
    expect(describeButtons(mountPagination({ total: 100, page: 9 }))).toEqual(
      ['‹', '1', '…<', '8', '[9]', '10', '›']
    )
  })

  it('labels the buttons and marks the current page', () => {
    const wrapper = mountPagination({ total: 30, page: 2 })
    const buttons = wrapper.findAll('button')
    expect(buttons.map(button => button.attributes('aria-label'))).toEqual([
      'Previous page',
      'Page 1',
      'Page 2',
      'Page 3',
      'Next page'
    ])
    expect(
      buttons.map(button => button.attributes('aria-current') ?? null)
    ).toEqual([null, null, 'page', null, null])
  })

  it('leaves the ellipses unlabelled', () => {
    const wrapper = mountPagination({ total: 100, page: 5 })
    expect(
      wrapper.find('.dito-button--ellipsis-prev').attributes('aria-label')
    ).toBeUndefined()
  })
})

describe('DitoPagination navigation', () => {
  it('emits `update:page` when clicking a page', async () => {
    const wrapper = mountPagination({ total: 30, page: 1 })
    await findPageButton(wrapper, 3).trigger('click')
    expect(wrapper.emitted('update:page')).toEqual([[3]])
    expect(wrapper.find('.dito-pagination-total').text()).toBe('21 – 30 / 30')
  })

  it('steps with the previous and next buttons', async () => {
    const wrapper = mountPagination({ total: 30, page: 2 })
    await clickButton(wrapper, '.dito-button--next')
    await clickButton(wrapper, '.dito-button--prev')
    await clickButton(wrapper, '.dito-button--prev')
    expect(wrapper.emitted('update:page')).toEqual([[3], [2], [1]])
  })

  it(`doesn't step beyond the first and last page`, async () => {
    const wrapper = mountPagination({ total: 30, page: 1 })
    await clickButton(wrapper, '.dito-button--prev')
    await wrapper.setProps({ page: 3 })
    const count = wrapper.emitted('update:page').length
    await clickButton(wrapper, '.dito-button--next')
    expect(wrapper.emitted('update:page')).toHaveLength(count)
  })

  it(`doesn't emit when clicking the current page`, async () => {
    const wrapper = mountPagination({ total: 30, page: 2 })
    await findPageButton(wrapper, 2).trigger('click')
    expect(wrapper.emitted('update:page')).toBeUndefined()
  })

  it('jumps ten pages with the ellipses, clamped to the ends', async () => {
    const wrapper = mountPagination({ total: 300, page: 15 })
    await clickButton(wrapper, '.dito-button--ellipsis-next')
    expect(wrapper.emitted('update:page')).toEqual([[25]])
    await clickButton(wrapper, '.dito-button--ellipsis-next')
    expect(wrapper.emitted('update:page').at(-1)).toEqual([30])
    await clickButton(wrapper, '.dito-button--ellipsis-prev')
    expect(wrapper.emitted('update:page').at(-1)).toEqual([20])
    await wrapper.setProps({ page: 4 })
    await clickButton(wrapper, '.dito-button--ellipsis-prev')
    expect(wrapper.emitted('update:page').at(-1)).toEqual([1])
  })

  it('follows changes of the page prop', async () => {
    const wrapper = mountPagination({ total: 100, page: 1 })
    await wrapper.setProps({ page: 5 })
    expect(wrapper.find('.dito-button--active').text()).toBe('5')
    expect(wrapper.find('.dito-pagination-total').text()).toBe('41 – 50 / 100')
  })

  it('moves to the last page when a larger page size removes the current', async () => {
    const wrapper = mountPagination({ total: 100, page: 8, pageSize: 10 })
    await wrapper.setProps({ pageSize: 25 })
    expect(wrapper.emitted('update:page')).toEqual([[4]])
    expect(wrapper.find('.dito-pagination-total').text()).toBe('76 – 100 / 100')
  })

  it('keeps the current page when it still exists after resizing', async () => {
    const wrapper = mountPagination({ total: 100, page: 2, pageSize: 10 })
    await wrapper.setProps({ pageSize: 20 })
    expect(wrapper.emitted('update:page')).toBeUndefined()
  })

  // Bug: without items there are 0 pages, so changing the page size moves the
  // current page to the invalid page 0.
  it.fails('stays on page 1 when resizing without items', async () => {
    const wrapper = mountPagination({ total: 0, page: 1, pageSize: 10 })
    await wrapper.setProps({ pageSize: 20 })
    expect(wrapper.emitted('update:page')).toBeUndefined()
  })
})
