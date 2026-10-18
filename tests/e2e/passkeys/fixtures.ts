import { defineScenario } from '../../utils/fixture-app.js'
import { scenario } from './app.js'

export { expect } from '@playwright/test'
export { sentPasswordResets } from './app.js'

// Browsers only allow passkeys in secure contexts, so the admin runs on
// `localhost` instead of the loopback address of the other scenarios:
export const getLocalUrl = (url: string) =>
  url.replace('//127.0.0.1:', '//localhost:')

export const test = defineScenario({
  dirname: import.meta.dirname,
  ...scenario,
  api: { users: 'users' }
})
