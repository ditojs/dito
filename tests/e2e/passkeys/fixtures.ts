import { db, defineScenario } from '../../utils/fixture-app.js'
import { scenario } from './app.js'

export { expect } from '@playwright/test'
export { db } from '../../utils/fixture-app.js'
export { sentPasswordResets } from './app.js'

// Browsers only allow passkeys in secure contexts, so the admin runs on
// `localhost` instead of the loopback address of the other scenarios:
export const getLocalUrl = (url: string) =>
  url.replace('//127.0.0.1:', '//localhost:')

const { seed, ...options } = scenario

export const test = defineScenario({
  dirname: import.meta.dirname,
  ...options,
  api: { users: { path: 'users' } },
  beforeEach: () => seed(db.em())
})
