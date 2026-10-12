import { labelize } from '@ditojs/utils'
import DitoConfirmMessage from '../components/DitoConfirmMessage.vue'
import { getTextFromHtml } from './html.js'
import defaultVerbs from '../verbs.js'

export const transientNote = (
  '<b>Note</b>: the parent still needs to be saved ' +
  'in order to persist this change.'
)

// Cancel comes first, to be focused first:
export async function confirm({ admin }, { message, verb }) {
  const result = await admin.showDialog(
    {
      components: {
        message: {
          type: 'component',
          component: DitoConfirmMessage,
          label: false
        }
      },
      buttons: {
        cancel: {},
        confirm: { type: 'submit', text: labelize(verb) }
      }
    },
    {
      data: { message },
      settings: { label: getTextFromHtml(message) }
    }
  )
  // Cancelled dialogs resolve with `undefined`:
  return result !== undefined
}

// Transient removals still need the parent to be saved, so they are confirmed
// with the verbs for removing instead of deleting, and note that.
export async function confirmAndRemove(
  services,
  { label, isTransient, remove }
) {
  const verbs = services.resource?.verbs ?? defaultVerbs
  const [verb, pastVerb] = isTransient
    ? [verbs.remove, verbs.removed]
    : [verbs.delete, verbs.deleted]
  const isConfirmed = await confirm(services, {
    message: `Do you really want to ${verb} ${label}?`,
    verb
  })
  if (isConfirmed && (await remove()) !== false) {
    services.admin.notify({
      type: isTransient ? 'info' : 'success',
      title: 'Successfully Removed',
      html: [`${label} was ${pastVerb}.`, isTransient && transientNote]
    })
  }
}
