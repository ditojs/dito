import { defineScenario } from '../../utils/fixture-app.js'
import { Album } from './models/Album.js'

export { expect } from '@playwright/test'

export const test = defineScenario({
  dirname: import.meta.dirname,
  models: { Album }
})
