import { defineScenario } from '../../utils/fixture-app.js'
import { Case } from './models/Case.js'

export { expect } from '@playwright/test'

export const test = defineScenario({
  dirname: import.meta.dirname,
  models: { Case },
  beforeEach: async () => {
    await Case.query().insert({ id: 1 })
  }
})
