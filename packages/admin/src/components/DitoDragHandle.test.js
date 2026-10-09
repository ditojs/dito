import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSchema } from '../test/mount.js'
import DitoDragHandle from './DitoDragHandle.vue'

async function mountBooks(books = {}) {
  return mountSchema({
    schema: {
      components: {
        books: {
          type: 'list',
          draggable: true,
          columns: { title: {} },
          ...books
        }
      }
    },
    data: { books: [{ title: 'Emma' }, { title: 'Dune' }] }
  })
}

function getTitles(data) {
  return data.books.map(book => book.title)
}

function findHandles(admin) {
  return admin.wrapper.findAllComponents(DitoDragHandle)
}

describe('DitoDragHandle', () => {
  it('is a focusable button with its keyboard shortcuts', async () => {
    const { admin } = await mountBooks()
    const [handle] = findHandles(admin)
    expect(handle.attributes()).toMatchObject({
      'role': 'button',
      'tabindex': '0',
      'aria-label': 'Drag',
      'aria-keyshortcuts': 'Alt+ArrowUp Alt+ArrowDown'
    })
    expect(handle.classes()).toContain('dito-button--drag')
  })

  it('moves the item on Alt+ArrowUp and Alt+ArrowDown', async () => {
    const { admin, data } = await mountBooks()
    await findHandles(admin)[0].trigger('keydown', {
      key: 'ArrowDown',
      altKey: true
    })
    expect(getTitles(data)).toEqual(['Dune', 'Emma'])
    await findHandles(admin)[1].trigger('keydown', {
      key: 'ArrowUp',
      altKey: true
    })
    expect(getTitles(data)).toEqual(['Emma', 'Dune'])
  })

  it('ignores the arrow keys without Alt', async () => {
    const { admin, data } = await mountBooks()
    await findHandles(admin)[0].trigger('keydown', { key: 'ArrowDown' })
    expect(getTitles(data)).toEqual(['Emma', 'Dune'])
  })

  it('keeps the focus on the handle of the moved item', async () => {
    const { admin } = await mountBooks()
    const [handle] = findHandles(admin)
    handle.element.focus()
    // Browsers blur moved elements, unlike happy-dom, so the handle has to
    // focus itself again after the move:
    const focus = vi.spyOn(handle.element, 'focus')
    await handle.trigger('keydown', { key: 'ArrowDown', altKey: true })
    await flushPromises()
    expect(focus).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(handle.element)
  })

  it('neither moves nor takes the focus when disabled', async () => {
    const { admin, data } = await mountBooks({ disabled: true })
    const [handle] = findHandles(admin)
    expect(handle.attributes()).toMatchObject({
      'tabindex': '-1',
      'aria-disabled': 'true'
    })
    const focus = vi.spyOn(handle.element, 'focus')
    await handle.trigger('keydown', { key: 'ArrowDown', altKey: true })
    await flushPromises()
    expect(getTitles(data)).toEqual(['Emma', 'Dune'])
    expect(focus).not.toHaveBeenCalled()
  })
})
