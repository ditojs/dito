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
  it('renders tree lists with children', async () => {
    const { dialog } = await showDialog({
      components: {
        pages: {
          type: 'tree-list',
          children: { name: 'subpages' }
        }
      },
      data: {
        pages: [{ name: 'About', subpages: [{ name: 'Team' }] }]
      },
      buttons: { cancel: {} }
    })
    expect(dialog.find('.dito-tree-item').exists()).toBe(true)
    expect(dialog.text()).toContain('About')
  })

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

  it('rejects through `dialogComponent.reject()` of its buttons', async () => {
    const error = new Error('Renaming is not allowed')
    const { dialog, promise, removeDialog } = await showDialog({
      components,
      buttons: {
        forbid: {
          type: 'button',
          text: 'Forbid',
          events: {
            click: ({ dialogComponent }) => dialogComponent.reject(error)
          }
        }
      }
    })
    await dialog.find('button[id="$buttons/forbid"]').trigger('click')
    await expect(promise).rejects.toBe(error)
    expect(removeDialog).toHaveBeenCalledOnce()
  })

  it('resolves as `undefined` with its cancel button', async () => {
    const { dialog, promise, removeDialog } = await showDialog({
      components,
      buttons: { cancel: {} },
      data: { title: 'Emma' }
    })
    await dialog.find('button.dito-button--cancel').trigger('click')
    expect(await promise).toBe(undefined)
    expect(removeDialog).toHaveBeenCalledOnce()
  })

  it('is its own dialog component', async () => {
    const { admin } = await showDialog({ components, buttons: { cancel: {} } })
    const { vm } = admin.wrapper.findComponent({ name: 'DitoDialog' })
    expect(vm.dialogComponent).toBe(vm)
  })

  it('submits with Enter in its inputs only', async () => {
    const result = await showDialog({
      components,
      buttons: { cancel: {}, apply: { type: 'submit' } },
      data: { title: 'Emma' }
    })
    await result.dialog.find('button.dito-button--cancel').trigger('keydown', {
      key: 'Enter'
    })
    await flushPromises()
    expect(result.isSettled).toBe(false)
    await result.dialog.find('input').trigger('keydown', { key: 'Enter' })
    expect(await result.promise).toEqual({ title: 'Emma' })
  })

  it(`doesn't close on overlay clicks without \`clickToClose\``, async () => {
    const result = await showDialog({ components, buttons: { cancel: {} } })
    await result.dialog.trigger('mouseup')
    await flushPromises()
    expect(result.isSettled).toBe(false)
  })
})
