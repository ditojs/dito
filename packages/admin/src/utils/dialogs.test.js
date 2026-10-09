import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountAdmin } from '../test/mount.js'
import { confirm, confirmAndRemove, transientNote } from './dialogs.js'

// Shows the dialog of `ask(root)` in a new admin, and returns its promise and
// the dialog element.
async function showConfirmDialog(ask) {
  const admin = await mountAdmin({ views: {} })
  const notify = vi.spyOn(admin.root, 'notify')
  const promise = ask(admin.root)
  await flushPromises()
  const dialog = admin.wrapper.find('.dito-dialog')
  return { promise, dialog, notify }
}

describe('confirm()', () => {
  it('shows the HTML message with a button for the verb', async () => {
    const { dialog } = await showConfirmDialog(root =>
      confirm(root, { message: 'Delete <b>Dune</b>?', verb: 'delete' })
    )
    expect(dialog.find('.dito-confirm-message').html()).toContain(
      '<b>Dune</b>'
    )
    expect(dialog.find('label').exists()).toBe(false)
    expect(dialog.attributes('aria-label')).toBe('Delete Dune?')
    expect(dialog.find('button[type="submit"]').text()).toBe('Delete')
  })

  it('resolves to true when confirmed', async () => {
    const { promise, dialog } = await showConfirmDialog(root =>
      confirm(root, { message: 'Delete Dune?', verb: 'delete' })
    )
    await dialog.find('button[type="submit"]').trigger('click')
    expect(await promise).toBe(true)
  })

  it('resolves to false when cancelled, also with Escape', async () => {
    const cancelled = await showConfirmDialog(root =>
      confirm(root, { message: 'Delete Dune?', verb: 'delete' })
    )
    await cancelled.dialog.find('.dito-button--cancel').trigger('click')
    expect(await cancelled.promise).toBe(false)

    const escaped = await showConfirmDialog(root =>
      confirm(root, { message: 'Delete Dune?', verb: 'delete' })
    )
    await escaped.dialog.trigger('keydown', { key: 'Escape' })
    expect(await escaped.promise).toBe(false)
  })
})

describe('confirmAndRemove()', () => {
  it('removes and notifies with the transient note once confirmed', async () => {
    const remove = vi.fn()
    const { promise, dialog, notify } = await showConfirmDialog(root =>
      confirmAndRemove(root, { label: 'Dune', isTransient: true, remove })
    )
    expect(dialog.attributes('aria-label')).toBe(
      'Do you really want to remove Dune?'
    )
    await dialog.find('button[type="submit"]').trigger('click')
    await promise
    expect(remove).toHaveBeenCalledOnce()
    expect(notify).toHaveBeenCalledWith({
      type: 'info',
      title: 'Successfully Removed',
      html: ['Dune was removed.', transientNote]
    })
  })

  it('deletes persisted items without the transient note', async () => {
    const { promise, dialog, notify } = await showConfirmDialog(root =>
      confirmAndRemove(root, {
        label: 'Dune',
        isTransient: false,
        remove: () => true
      })
    )
    expect(dialog.attributes('aria-label')).toBe(
      'Do you really want to delete Dune?'
    )
    await dialog.find('button[type="submit"]').trigger('click')
    await promise
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        html: ['Dune was deleted.', false]
      })
    )
  })

  it(`doesn't remove when cancelled, nor notify when removing fails`, async () => {
    const remove = vi.fn()
    const cancelled = await showConfirmDialog(root =>
      confirmAndRemove(root, { label: 'Dune', isTransient: true, remove })
    )
    await cancelled.dialog.find('.dito-button--cancel').trigger('click')
    await cancelled.promise
    expect(remove).not.toHaveBeenCalled()

    const failed = await showConfirmDialog(root =>
      confirmAndRemove(root, {
        label: 'Dune',
        isTransient: true,
        remove: () => false
      })
    )
    await failed.dialog.find('button[type="submit"]').trigger('click')
    await failed.promise
    expect(failed.notify).not.toHaveBeenCalled()
  })
})
