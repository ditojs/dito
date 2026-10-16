export const dashboard = {
  type: 'view',
  label: 'Dashboard',
  components: {}
} as const

export const login = {
  passkeys: true,
  totp: true
} as const
