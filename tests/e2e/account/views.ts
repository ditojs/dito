export const dashboard = {
  type: 'view',
  label: 'Dashboard',
  fields: {}
} as const

export const account = {
  settings: {
    type: 'form',
    label: 'Account',
    fields: {
      username: { type: 'text', label: 'Username' },
      email: { type: 'email', label: 'Email' }
    }
  }
} as const
