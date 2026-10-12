import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountAdmin } from '../test/mount.js'

// Shows a dialog through `DitoRoot.showDialog()`, and returns its promise, the
// dialog element, whether it's still shown, and whether the promise settled.
async function showDialog(schema, options) {
  const admin = await mountAdmin({ views: {} })
  let isSettled = false
  const promise = admin.context.showDialog(schema, options).finally(() => {
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

const components = { title: { type: 'text' } }

describe('DitoDialog', () => {
  it('renders tree lists with children', async () => {
    const { dialog } = await showDialog(
      {
        components: {
          pages: {
            type: 'tree-list',
            children: { name: 'subpages' }
          }
        },
        buttons: { cancel: {} }
      },
      { data: { pages: [{ name: 'About', subpages: [{ name: 'Team' }] }] } }
    )
    expect(dialog.find('.dito-tree-item').exists()).toBe(true)
    expect(dialog.text()).toContain('About')
  })

  it('labels the dialog with `settings.label`', async () => {
    const { dialog } = await showDialog(
      { components, buttons: { cancel: {} } },
      { settings: { label: 'Rename Book' } }
    )
    expect(dialog.attributes('aria-label')).toBe('Rename Book')
  })

  it('closes with `clickToClose` only when the overlay is clicked', async () => {
    const result = await showDialog(
      { components, buttons: { cancel: {} } },
      { settings: { clickToClose: true } }
    )
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

  it('resolves with the data on submit and removes itself', async () => {
    const { dialog, promise, isShown } = await showDialog(
      { components, buttons: { cancel: {}, apply: { type: 'submit' } } },
      { data: { title: 'Emma' } }
    )
    await dialog.find('form').trigger('submit')
    expect(await promise).toEqual({ title: 'Emma' })
    await flushPromises()
    expect(isShown()).toBe(false)
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

  it('resolves with the value of `closeDialog()` of its buttons', async () => {
    const { dialog, promise, isShown } = await showDialog({
      components,
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

  it('validates, edits and replaces its data through contexts', async () => {
    const click = vi.fn()
    const { dialog, promise } = await showDialog({
      components: {
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
    context.markEdited()
    expect(context.isDirty).toBe(true)
    // Replaced data is set up with the defaults, and isn't edited:
    expect(context.replaceItem({ title: 'Emma' })).toEqual({
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

  it('resolves as `undefined` with its cancel button', async () => {
    const { dialog, promise, isShown } = await showDialog(
      { components, buttons: { cancel: {} } },
      { data: { title: 'Emma' } }
    )
    await dialog.find('button.dito-button--cancel').trigger('click')
    expect(await promise).toBe(undefined)
    expect(isShown()).toBe(false)
  })

  it('submits with Enter in its inputs only', async () => {
    const result = await showDialog(
      { components, buttons: { cancel: {}, apply: { type: 'submit' } } },
      { data: { title: 'Emma' } }
    )
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
