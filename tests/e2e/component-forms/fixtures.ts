import { defineScenario } from '../../utils/fixture-app.js'
import { Product } from './models/Product.js'

export { expect } from '@playwright/test'
export { db } from '../../utils/fixture-app.js'

export const test = defineScenario({
  dirname: import.meta.dirname,
  entities: [Product]
})
