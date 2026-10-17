export const dashboard = {
  type: 'view',
  label: 'Dashboard',
  components: {}
} as const

export const account = {
  settings: {
    type: 'form',
    label: 'Account',
    components: {
      username: { type: 'text', label: 'Username' },
      email: { type: 'email', label: 'Email' }
    }
  }
} as const
