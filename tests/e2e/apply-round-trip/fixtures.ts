import { defineScenario } from '../../utils/fixture-app.js'
import { Book } from './models/Book.js'

export { expect } from '@playwright/test'

export const test = defineScenario({
  dirname: import.meta.dirname,
  models: { Book }
})
