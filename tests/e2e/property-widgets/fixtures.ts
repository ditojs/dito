import { defineScenario } from '../../utils/fixture-app.js'
import { Author } from './models/Author.js'
import { Volume } from './models/Volume.js'
import { Collection } from './models/Collection.js'

export { expect } from '@playwright/test'
export { db } from '../../utils/fixture-app.js'

export const test = defineScenario({
  dirname: import.meta.dirname,
  entities: [Author, Volume, Collection]
})
