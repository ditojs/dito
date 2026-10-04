import { defineScenario } from '../../utils/fixture-app.js'
import { Widget } from './models/Widget.js'

export { expect } from '@playwright/test'

export const test = defineScenario({
  dirname: import.meta.dirname,
  models: { Widget }
})
