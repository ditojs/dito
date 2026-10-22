import { defineScenario } from '../../utils/fixture-app.js'
import { Designer } from './models/Designer.js'
import { ShopSet } from './models/ShopSet.js'
import { Collection } from './models/Collection.js'

export { expect } from '@playwright/test'

export const test = defineScenario({
  dirname: import.meta.dirname,
  models: { Designer, ShopSet, Collection }
})
