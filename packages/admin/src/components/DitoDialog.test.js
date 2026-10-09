import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountAdmin } from '../test/mount.js'

// Shows a dialog through `DitoRoot.showDialog()`, and returns its promise, the
// dialog element, and whether the promise settled.
async function showDialog(options) {
  const admin = await mountAdmin({ views: {} })
  const removeDialog = vi.spyOn(admin.root, 'removeDialog')
  let isSettled = false
  const promise = admin.root.showDialog(options).finally(() => {
    isSettled = true
  })
  await flushPromises()
  const dialog = admin.wrapper.find('.dito-dialog')
  return {
    admin,
    promise,
    dialog,
    removeDialog,
    get isSettled() {
      return isSettled
    }
  }
}

const components = { title: { type: 'text' } }

describe('DitoDialog', () => {
  it('labels the dialog with `settings.label`', async () => {
    const { dialog } = await showDialog({
      components,
      buttons: { cancel: {} },
      settings: { label: 'Rename Book' }
    })
    expect(dialog.attributes('aria-label')).toBe('Rename Book')
  })

  it('closes with `clickToClose` only when the overlay is clicked', async () => {
    const result = await showDialog({
      components,
      buttons: { cancel: {} },
      settings: { clickToClose: true }
    })
    await result.dialog.find('input').trigger('mouseup')
    await flushPromises()
    expect(result.isSettled).toBe(false)
    await result.dialog.trigger('mouseup')
    expect(await result.promise).toBe(undefined)
  })

  it('cancels with Escape only with a cancel button', async () => {
    const withoutCancel = await showDialog({
      components,
      buttons: { apply: { type: 'submit' } }
    })
    await withoutCancel.dialog.find('input').trigger('keydown', {
      key: 'Escape'
    })
    await flushPromises()
    expect(withoutCancel.isSettled).toBe(false)

    const withCancel = await showDialog({
      components,
      buttons: { cancel: {}, apply: { type: 'submit' } }
    })
    await withCancel.dialog.find('input').trigger('keydown', { key: 'Escape' })
    expect(await withCancel.promise).toBe(undefined)
  })

  it('resolves with the data on submit and removes itself once', async () => {
    const { dialog, promise, removeDialog } = await showDialog({
      components,
      buttons: { cancel: {}, apply: { type: 'submit' } },
      data: { title: 'Emma' }
    })
    await dialog.find('form').trigger('submit')
    expect(await promise).toEqual({ title: 'Emma' })
    await flushPromises()
    expect(removeDialog).toHaveBeenCalledOnce()
  })

  it(`doesn't cancel with Escape keys that its components handled`, async () => {
    const result = await showDialog({
      components,
      buttons: { cancel: {} }
    })
    const input = result.dialog.find('input')
    // Like a component that closes its menu with Escape:
    input.element.addEventListener('keydown', event => event.preventDefault())
    await input.trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(result.isSettled).toBe(false)
  })
})
