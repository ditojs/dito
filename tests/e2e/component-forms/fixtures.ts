import { defineScenario } from '../../utils/fixture-app.js'
import { Product } from './models/Product.js'

export { expect } from '@playwright/test'

export const test = defineScenario({
  dirname: import.meta.dirname,
  models: { Product }
})
