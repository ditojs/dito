import { defineScenario } from '../../utils/fixture-app.js'
import { Project } from './models/Project.js'

export { expect } from '@playwright/test'

export const test = defineScenario({
  dirname: import.meta.dirname,
  models: { Project }
})
