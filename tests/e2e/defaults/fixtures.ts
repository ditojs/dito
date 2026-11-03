import { defineScenario } from '../../utils/fixture-app.js'
import { Draft } from './models/Draft.js'

export { expect } from '@playwright/test'
export { db } from '../../utils/fixture-app.js'

export const test = defineScenario({
  dirname: import.meta.dirname,
  entities: [Draft]
})
