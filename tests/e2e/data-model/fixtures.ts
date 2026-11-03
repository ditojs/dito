import { defineScenario } from '../../utils/fixture-app.js'
import { Article } from './models/Article.js'

export { expect } from '@playwright/test'
export { db } from '../../utils/fixture-app.js'

export const test = defineScenario({
  dirname: import.meta.dirname,
  entities: [Article]
})
