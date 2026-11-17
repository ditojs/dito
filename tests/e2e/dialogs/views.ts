import type { ViewSchema } from '@ditojs/admin'

export const dialogs: ViewSchema = {
  type: 'view',
  label: 'Dialogs',
  fields: {
    openDialog: {
      type: 'button',
      text: 'Open Dialog',
      onClick: ({ showDialog }) => {
        showDialog({
          fields: {
            message: { type: 'text', label: 'Message' }
          },
          buttons: {
            cancel: { text: 'Cancel' },
            submit: { text: 'Send' }
          },
          settings: { clickToClose: true }
        })
      }
    }
  }
}
