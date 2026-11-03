import { defineScenario } from '../../utils/fixture-app.js'
import { Dashboard } from './models/Dashboard.js'
import { Team } from './models/Team.js'

export { expect } from '@playwright/test'
export { db } from '../../utils/fixture-app.js'

export const test = defineScenario({
  dirname: import.meta.dirname,
  entities: [Team, Dashboard]
})
