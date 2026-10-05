import { defineScenario } from '../../utils/fixture-app.js'
import { Article } from './models/Article.js'

export { expect } from '@playwright/test'

export const test = defineScenario({
  dirname: import.meta.dirname,
  models: { Article }
})
