import { defineScenario } from '../../utils/fixture-app.js'
import { Dashboard } from './models/Dashboard.js'
import { Team } from './models/Team.js'

export { expect } from '@playwright/test'

export const test = defineScenario({
  dirname: import.meta.dirname,
  models: { Team, Dashboard }
})
