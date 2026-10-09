// Confirmations, built on the promise-based and focus-trapped dialogs of
// `DitoRoot.showDialog()`. `component` is the Dito component that asks, for
// its `showDialog()`, `notify()` and `verbs`, see `DitoMixin`.
import { labelize } from '@ditojs/utils'
import DitoConfirmMessage from '../components/DitoConfirmMessage.vue'
import { getTextFromHtml } from './html.js'

export const transientNote = (
  '<b>Note</b>: the parent still needs to be saved ' +
  'in order to persist this change.'
)

// Asks the user to confirm the HTML `message` with a button for `verb`, and
// resolves to whether they did. Cancel comes first, to be focused first.
export async function confirm(component, { message, verb }) {
  const result = await component.showDialog({
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
    },
    data: { message },
    settings: { label: getTextFromHtml(message) }
  })
  // The dialog resolves with its data when submitted, and with `undefined`
  // when cancelled, see `DitoDialog.cancel()`.
  return result !== undefined
}

// Asks the user to confirm the removal of the item with the HTML `label`, then
// awaits `remove()`, which returns false if it failed, and notifies of the
// removal. Transient removals still need the parent to be saved, so they are
// confirmed with the verbs for removing instead of deleting, and note that.
export async function confirmAndRemove(
  component,
  { label, isTransient, remove }
) {
  const { verbs } = component
  const [verb, pastVerb] = isTransient
    ? [verbs.remove, verbs.removed]
    : [verbs.delete, verbs.deleted]
  const isConfirmed = await confirm(component, {
    message: `Do you really want to ${verb} ${label}?`,
    verb
  })
  if (isConfirmed && (await remove()) !== false) {
    component.notify({
      type: isTransient ? 'info' : 'success',
      title: 'Successfully Removed',
      html: [`${label} was ${pastVerb}.`, isTransient && transientNote]
    })
  }
}
