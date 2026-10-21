import { labelize, html } from '@ditojs/utils'
import DitoConfirmMessage from '../components/DitoConfirmMessage.vue'
import { getHtml, getText } from './html.js'
import { getVerbs } from './services.ts'

export const transientNote = html([
  '<b>Note</b>: the parent still needs to be saved ' +
  'in order to persist this change.'
])

export async function confirm(
  { adminContext },
  message,
  { action = 'OK' } = {}
) {
  const result = await showMessageDialog(adminContext, message, {
    buttons: {
      cancel: {},
      confirm: { type: 'submit', text: action }
    }
  })
  // Cancelled dialogs resolve with `undefined`:
  return result !== undefined
}

export async function prompt(
  { adminContext },
  message,
  { action = 'OK', value = null, type = 'text' } = {}
) {
  // Labels are cut off, so the message above labels the field instead, by the
  // id of its component path, unique across dialogs:
  const messageName = `dito-prompt-message-${++promptCount}`
  const result = await showMessageDialog(adminContext, message, {
    messageName,
    fields: {
      value: {
        type,
        label: false,
        labelledBy: messageName,
        autofocus: true
      }
    },
    buttons: {
      cancel: {},
      confirm: { type: 'submit', text: action }
    },
    data: { value }
  })
  return result?.value
}

// Escape closes the alert too, as it has only one button:
export async function alert(
  { adminContext },
  message,
  { action = 'OK' } = {}
) {
  await showMessageDialog(adminContext, message, {
    buttons: {
      close: { type: 'submit', text: action }
    }
  })
}

// Transient removals still need the parent to be saved, so they are confirmed
// with the verbs for removing instead of deleting, and note that.
export async function confirmAndRemove(
  services,
  { label, isTransient, remove }
) {
  const verbs = getVerbs(services)
  const [verb, pastVerb] = isTransient
    ? [verbs.remove, verbs.removed]
    : [verbs.delete, verbs.deleted]
  const isConfirmed = await confirm(
    services,
    html`Do you really want to ${verb} ${label}?`,
    { action: labelize(verb) }
  )
  if (isConfirmed && (await remove()) !== false) {
    services.adminContext.notify({
      type: isTransient ? 'info' : 'success',
      title: 'Successfully Removed',
      text: [html`${label} was ${pastVerb}.`, isTransient && transientNote]
    })
  }
}

function showMessageDialog(
  adminContext,
  message,
  { messageName = 'message', fields, buttons, data }
) {
  return adminContext.showDialog({
    fields: {
      [messageName]: {
        type: 'component',
        component: DitoConfirmMessage,
        label: false
      },
      ...fields
    },
    buttons,
    data: { [messageName]: getHtml(message), ...data },
    settings: { label: getText(message) }
  })
}

let promptCount = 0
