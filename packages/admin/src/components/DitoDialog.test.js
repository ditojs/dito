import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountAdmin, enterValue } from '../test/mount.js'

// Shows a dialog through `DitoRoot.showDialog()`, and returns its promise, the
// dialog element, whether it's still shown, and whether the promise settled.
async function showDialog(options) {
  const admin = await mountAdmin({ views: {} })
  let isSettled = false
  const promise = admin.context.showDialog(options).finally(() => {
    isSettled = true
  })
  await flushPromises()
  const dialog = admin.wrapper.find('.dito-dialog')
  return {
    admin,
    promise,
    dialog,
    isShown: () => Object.keys(admin.root.dialogs).length > 0,
    get isSettled() {
      return isSettled
    }
  }
}

const fields = { title: { type: 'text' } }

describe('DitoDialog', () => {
  it('renders tree lists with children', async () => {
    const { dialog } = await showDialog({
      fields: {
        pages: {
          type: 'tree-list',
          children: { name: 'subpages' }
        }
      },
      buttons: { cancel: {} },
      data: { pages: [{ name: 'About', subpages: [{ name: 'Team' }] }] }
    })
    expect(dialog.find('.dito-tree-item').exists()).toBe(true)
    expect(dialog.text()).toContain('About')
  })

  it('marks the container of its cancel button, with the class of the app', async () => {
    const getClasses = async cancel => {
      const { dialog } = await showDialog({
        fields,
        buttons: { apply: { type: 'submit' }, cancel }
      })
      return dialog
        .findAll('.dito-buttons__container')
        .map(container => container.classes())
    }
    const [apply, cancel] = await getClasses({})
    expect(apply).not.toContain('dito-dialog__cancel')
    expect(cancel).toContain('dito-dialog__cancel')
    const [, string] = await getClasses({ class: 'danger' })
    expect(string).toEqual(
      expect.arrayContaining(['dito-dialog__cancel', 'danger'])
    )
    const [, object] = await getClasses({
      class: { danger: true, muted: false }
    })
    expect(object).toEqual(
      expect.arrayContaining(['dito-dialog__cancel', 'danger'])
    )
    expect(object).not.toContain('muted')
  })

  it('labels the dialog with `settings.label`', async () => {
    const { dialog } = await showDialog({
      fields,
      buttons: { cancel: {} },
      settings: { label: 'Rename Book' }
    })
    expect(dialog.attributes('aria-label')).toBe('Rename Book')
  })

  it('sizes its content with `settings.width` in pixels or CSS lengths', async () => {
    const getWidth = async width => {
      const { dialog } = await showDialog({
        fields,
        buttons: { cancel: {} },
        settings: { width }
      })
      return dialog.element.style.getPropertyValue('--width')
    }
    expect(await getWidth(400)).toBe('400px')
    expect(await getWidth('25em')).toBe('25em')
    expect(await getWidth(undefined)).toBe('')
  })

  it('sizes its content at least with `settings.minWidth`', async () => {
    const { dialog } = await showDialog({
      fields,
      buttons: { cancel: {} },
      settings: { minWidth: '30em', width: 600 }
    })
    const { style } = dialog.element
    expect(style.getPropertyValue('--min-width')).toBe('30em')
    expect(style.getPropertyValue('--width')).toBe('600px')
  })

  it('closes with `clickToClose` only when the overlay is clicked', async () => {
    const result = await showDialog({
      fields,
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
      fields,
      buttons: { apply: { type: 'submit' }, remove: {} }
    })
    await withoutCancel.dialog.find('input').trigger('keydown', {
      key: 'Escape'
    })
    await flushPromises()
    expect(withoutCancel.isSettled).toBe(false)

    const withCancel = await showDialog({
      fields,
      buttons: { cancel: {}, apply: { type: 'submit' } }
    })
    await withCancel.dialog.find('input').trigger('keydown', { key: 'Escape' })
    expect(await withCancel.promise).toBe(undefined)
  })

  it('cancels with Escape with only one button', async () => {
    const { dialog, promise } = await showDialog({
      fields,
      buttons: { apply: { type: 'submit' } }
    })
    await dialog.find('input').trigger('keydown', { key: 'Escape' })
    expect(await promise).toBe(undefined)
  })

  it('cancels with Escape without buttons', async () => {
    for (const buttons of [undefined, {}]) {
      const { dialog, promise } = await showDialog({ fields, buttons })
      await dialog.find('input').trigger('keydown', { key: 'Escape' })
      expect(await promise).toBe(undefined)
    }
  })

  it('shows no buttons without any that render', async () => {
    const hidden = { type: 'button', text: 'Hidden', if: () => false }
    for (const buttons of [{}, { hidden }]) {
      const { dialog } = await showDialog({ fields, buttons })
      expect(dialog.find('.dito-dialog__buttons').exists()).toBe(false)
    }
  })

  it('shows dialogs without components', async () => {
    const { dialog, promise } = await showDialog({ buttons: { cancel: {} } })
    await dialog.find('.dito-button').trigger('click')
    expect(await promise).toBe(undefined)
  })

  it('resolves with the data on submit and removes itself', async () => {
    const { dialog, promise, isShown } = await showDialog({
      fields,
      buttons: { cancel: {}, apply: { type: 'submit' } },
      data: { title: 'Emma' }
    })
    await dialog.find('form').trigger('submit')
    expect(await promise).toEqual({ title: 'Emma' })
    await flushPromises()
    expect(isShown()).toBe(false)
  })

  it('stays visible for `minDuration` when submitted right away', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] })
    try {
      const result = await showDialog({
        fields,
        buttons: { apply: { type: 'submit' } },
        data: { title: 'Emma' },
        settings: { minDuration: 1000 }
      })
      await result.dialog.find('form').trigger('submit')
      await vi.advanceTimersByTimeAsync(900)
      expect(result.isSettled).toBe(false)
      expect(result.isShown()).toBe(true)
      await vi.advanceTimersByTimeAsync(100)
      expect(await result.promise).toEqual({ title: 'Emma' })
    } finally {
      vi.useRealTimers()
    }
  })

  it(`doesn't cancel with Escape keys that its components handled`, async () => {
    const result = await showDialog({
      fields,
      buttons: { cancel: {} }
    })
    const input = result.dialog.find('input')
    // Like a component that closes its menu with Escape:
    input.element.addEventListener('keydown', event => event.preventDefault())
    await input.trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(result.isSettled).toBe(false)
  })

  it('resolves with the value of `closeDialog()` of its buttons', async () => {
    const { dialog, promise, isShown } = await showDialog({
      fields,
      buttons: {
        keep: {
          type: 'button',
          text: 'Keep',
          onClick: ({ closeDialog }) => closeDialog('kept')
        }
      }
    })
    await dialog.find('button[id="$buttons/keep"]').trigger('click')
    expect(await promise).toBe('kept')
    expect(isShown()).toBe(false)
  })

  it('focuses its primary button without a submit button', async () => {
    const { dialog } = await showDialog({
      buttons: {
        cancel: {},
        remove: { type: 'button', text: 'Delete Revision', primary: true }
      }
    })
    const button = dialog.find('button[id="$buttons/remove"]').element
    // The focus trap focuses initially after a delay:
    await vi.waitFor(() => expect(document.activeElement).toBe(button))
  })

  it('validates, edits and replaces its data through contexts', async () => {
    const click = vi.fn()
    const { dialog, promise } = await showDialog({
      fields: {
        title: { type: 'text', required: true },
        rating: { type: 'number', default: 3 }
      },
      buttons: {
        check: { type: 'button', text: 'Check', onClick: click },
        apply: { type: 'submit' }
      }
    })
    await dialog.find('button[id="$buttons/check"]').trigger('click')
    const [context] = click.mock.calls[0]
    expect(context.isDirty).toBe(false)
    expect(context.isCreating).toBe(false)
    expect(context.validate()).toBe(false)
    await flushPromises()
    expect(dialog.find('.dito-errors').text()).toContain('required')
    context.markDirty()
    expect(context.isDirty).toBe(true)
    // Replaced data is set up with the defaults, and isn't edited:
    expect(context.resetItem({ title: 'Emma' })).toEqual({
      title: 'Emma',
      rating: 3
    })
    expect(context.isDirty).toBe(false)
    await flushPromises()
    expect(dialog.find('input[name="title"]').element.value).toBe('Emma')
    expect(context.validate()).toBe(true)
    expect(() => context.closeForm()).toThrow(
      'Unable to close the form: There is no form.'
    )
    await dialog.find('form').trigger('submit')
    expect(await promise).toEqual({ title: 'Emma', rating: 3 })
  })

  it('merges values into its data through contexts', async () => {
    const click = vi.fn()
    const { dialog, promise } = await showDialog({
      fields: {
        title: { type: 'text' },
        rating: { type: 'number', default: 3 }
      },
      buttons: {
        check: { type: 'button', text: 'Check', onClick: click },
        apply: { type: 'submit' }
      }
    })
    await enterValue(dialog.find('input[name="title"]'), 'Emma')
    await dialog.find('button[id="$buttons/check"]').trigger('click')
    const [context] = click.mock.calls[0]
    expect(context.isDirty).toBe(true)
    expect(context.mergeItem({ rating: 5 })).toEqual({
      title: 'Emma',
      rating: 5
    })
    expect(context.isDirty).toBe(true)
    await dialog.find('form').trigger('submit')
    expect(await promise).toEqual({ title: 'Emma', rating: 5 })
  })

  it('resolves as `undefined` with its cancel button', async () => {
    const { dialog, promise, isShown } = await showDialog({
      fields,
      buttons: { cancel: {} },
      data: { title: 'Emma' }
    })
    await dialog.find('button.dito-button--cancel').trigger('click')
    expect(await promise).toBe(undefined)
    expect(isShown()).toBe(false)
  })

  it('caches local requests while it is shown', async () => {
    const request = vi.fn(() => ({ data: ['Classic', 'Modern'] }))
    const admin = await mountAdmin({ views: {}, request })
    const genre = {
      type: 'select',
      options: {
        data: ({ request }) => request({ url: 'genres', cache: 'local' })
      }
    }
    const showGenres = async () => {
      const promise = admin.context.showDialog({
        fields: { genre, subgenre: genre },
        buttons: { cancel: {} }
      })
      await flushPromises()
      const dialog = admin.wrapper.findAll('.dito-dialog').at(-1)
      await dialog.find('button.dito-button--cancel').trigger('click')
      await promise
    }
    await showGenres()
    expect(request).toHaveBeenCalledOnce()
    // The next dialog loads them again:
    await showGenres()
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('submits with Enter in its inputs only', async () => {
    const result = await showDialog({
      fields,
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
    const result = await showDialog({ fields, buttons: { cancel: {} } })
    await result.dialog.trigger('mouseup')
    await flushPromises()
    expect(result.isSettled).toBe(false)
  })
})
