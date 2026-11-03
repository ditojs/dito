import { defineScenario } from '../../utils/fixture-app.js'
import { Library } from './models/Library.js'

export { expect } from '@playwright/test'
export { db } from '../../utils/fixture-app.js'

export const test = defineScenario({
  dirname: import.meta.dirname,
  entities: [Library],
  // Named explicitly, as the plural of `Library` isn't `Librarys`.
  controllers: { Library: { path: 'libraries' } }
})
