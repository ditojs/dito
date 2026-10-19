import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountAdmin, enterValue } from '../test/mount.js'
import {
  confirm,
  prompt,
  alert,
  confirmAndRemove,
  transientNote
} from './dialogs.js'

// Shows the dialog of `ask(root)` in a new admin, and returns its promise and
// the dialog element.
async function showDialog(ask) {
  const admin = await mountAdmin({ views: {} })
  const notify = vi.spyOn(admin.context, 'notify')
  const promise = ask(admin.root)
  await flushPromises()
  const dialog = admin.wrapper.find('.dito-dialog')
  return { promise, dialog, notify }
}

describe('confirm()', () => {
  it('shows the HTML message with a button for the action', async () => {
    const { dialog } = await showDialog(root =>
      confirm(root, 'Delete <b>Dune</b>?', { action: 'Delete' })
    )
    expect(dialog.find('.dito-confirm-message').html()).toContain(
      '<b>Dune</b>'
    )
    expect(dialog.find('label').exists()).toBe(false)
    expect(dialog.attributes('aria-label')).toBe('Delete Dune?')
    expect(dialog.find('button[type="submit"]').text()).toBe('Delete')
  })

  it(`confirms with an 'OK' button without an action`, async () => {
    const { dialog } = await showDialog(root => confirm(root, 'Proceed?'))
    expect(dialog.find('button[type="submit"]').text()).toBe('OK')
    expect(dialog.find('.dito-button--cancel').attributes('title')).toBe(
      'Cancel'
    )
  })

  it('follows the contract of custom components', async () => {
    const warn = vi.spyOn(console, 'warn')
    await showDialog(root =>
      confirm(root, 'Delete Dune?', { action: 'Delete' })
    )
    expect(warn).not.toHaveBeenCalled()
  })

  it('resolves to true when confirmed', async () => {
    const { promise, dialog } = await showDialog(root =>
      confirm(root, 'Delete Dune?', { action: 'Delete' })
    )
    await dialog.find('button[type="submit"]').trigger('click')
    expect(await promise).toBe(true)
  })

  it('resolves to false when cancelled, also with Escape', async () => {
    const cancelled = await showDialog(root =>
      confirm(root, 'Delete Dune?', { action: 'Delete' })
    )
    await cancelled.dialog.find('.dito-button--cancel').trigger('click')
    expect(await cancelled.promise).toBe(false)

    const escaped = await showDialog(root =>
      confirm(root, 'Delete Dune?', { action: 'Delete' })
    )
    await escaped.dialog.trigger('keydown', { key: 'Escape' })
    expect(await escaped.promise).toBe(false)
  })
})

describe('prompt()', () => {
  it('asks for the value in a field below the HTML message', async () => {
    const { promise, dialog } = await showDialog(root =>
      prompt(root, 'Rename <b>Dune</b>:', { action: 'Rename', value: 'Dune' })
    )
    expect(dialog.attributes('aria-label')).toBe('Rename Dune:')
    const message = dialog.find('.dito-confirm-message')
    expect(message.html()).toContain('<b>Dune</b>')
    const input = dialog.find('input')
    expect(
      message.element.compareDocumentPosition(input.element) &
      Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    // The message labels the field, which has no label of its own:
    const messageId = message.attributes('id')
    expect(messageId).toBeTruthy()
    expect(input.attributes('aria-labelledby')).toBe(messageId)
    expect(dialog.find('label').exists()).toBe(false)
    expect(input.element.value).toBe('Dune')
    expect(input.attributes('autofocus')).toBeDefined()
    expect(dialog.find('button[type="submit"]').text()).toBe('Rename')
    await enterValue(input, 'Dune Messiah')
    await dialog.find('button[type="submit"]').trigger('click')
    expect(await promise).toBe('Dune Messiah')
  })

  it(`submits empty values with an 'OK' button without options`, async () => {
    const { promise, dialog } = await showDialog(root => prompt(root, 'Title:'))
    expect(dialog.find('input').element.value).toBe('')
    const button = dialog.find('button[type="submit"]')
    expect(button.text()).toBe('OK')
    await button.trigger('click')
    expect(await promise).toBe(null)
  })

  it('validates the value of its type', async () => {
    const { promise, dialog } = await showDialog(root =>
      prompt(root, 'Email:', { type: 'email' })
    )
    const input = dialog.find('input')
    await enterValue(input, 'ada')
    await dialog.find('form').trigger('submit')
    await flushPromises()
    expect(dialog.find('.dito-errors').exists()).toBe(true)
    await enterValue(input, 'ada@example.com')
    await dialog.find('form').trigger('submit')
    expect(await promise).toBe('ada@example.com')
  })

  it('resolves to undefined when cancelled, also with Escape', async () => {
    const cancelled = await showDialog(root =>
      prompt(root, 'Title:', { value: 'Dune' })
    )
    await cancelled.dialog.find('.dito-button--cancel').trigger('click')
    expect(await cancelled.promise).toBe(undefined)

    const escaped = await showDialog(root =>
      prompt(root, 'Title:', { value: 'Dune' })
    )
    await escaped.dialog.trigger('keydown', { key: 'Escape' })
    expect(await escaped.promise).toBe(undefined)
  })
})

describe('alert()', () => {
  it('shows the HTML message with only a button for the action', async () => {
    const { promise, dialog } = await showDialog(root =>
      alert(root, 'Dune was <b>sold out</b>.', { action: 'Close' })
    )
    expect(dialog.attributes('aria-label')).toBe('Dune was sold out.')
    expect(dialog.find('.dito-confirm-message').html()).toContain(
      '<b>sold out</b>'
    )
    const buttons = dialog.findAll('.dito-dialog__buttons button')
    expect(buttons.map(button => button.text())).toEqual(['Close'])
    // Styled as the primary button, not as a cancel button:
    expect(buttons[0].attributes('type')).toBe('submit')
    expect(buttons[0].classes()).not.toContain('dito-button--cancel')
    await buttons[0].trigger('click')
    expect(await promise).toBe(undefined)
  })

  it(`closes with an 'OK' button without an action, also with Escape`, async () => {
    const clicked = await showDialog(root => alert(root, 'Dune was sold.'))
    const button = clicked.dialog.find('.dito-dialog__buttons button')
    expect(button.text()).toBe('OK')
    await button.trigger('click')
    await clicked.promise

    const escaped = await showDialog(root => alert(root, 'Dune was sold.'))
    await escaped.dialog.trigger('keydown', { key: 'Escape' })
    await escaped.promise
  })
})

describe('confirmAndRemove()', () => {
  it('removes and notifies with the transient note once confirmed', async () => {
    const remove = vi.fn()
    const { promise, dialog, notify } = await showDialog(root =>
      confirmAndRemove(root, { label: 'Dune', isTransient: true, remove })
    )
    expect(dialog.attributes('aria-label')).toBe(
      'Do you really want to remove Dune?'
    )
    expect(dialog.find('button[type="submit"]').text()).toBe('Remove')
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
    const { promise, dialog, notify } = await showDialog(root =>
      confirmAndRemove(root, {
        label: 'Dune',
        isTransient: false,
        remove: () => true
      })
    )
    expect(dialog.attributes('aria-label')).toBe(
      'Do you really want to delete Dune?'
    )
    expect(dialog.find('button[type="submit"]').text()).toBe('Delete')
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
    const cancelled = await showDialog(root =>
      confirmAndRemove(root, { label: 'Dune', isTransient: true, remove })
    )
    await cancelled.dialog.find('.dito-button--cancel').trigger('click')
    await cancelled.promise
    expect(remove).not.toHaveBeenCalled()

    const failed = await showDialog(root =>
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
