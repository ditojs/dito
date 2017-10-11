import path from 'path'
import fs from 'fs-extra'
import {isFunction} from '../utils'
import models from '../models'

async function seed() {
  const seedDir = __dirname
  const files = await fs.readdir(seedDir)
  for (const file of files) {
    const desc = path.parse(file)
    if (file !== 'index.js' && /^\.(js|json)$/.test(desc.ext)) {
      const object = await import(path.resolve(seedDir, file))
      const seed = object.default || object
      const model = models[desc.name]
      if (model) {
        await model.query().truncate()
        if (isFunction(seed)) {
          await seed(model, models)
        } else {
          await model.query().insertGraph(seed)
        }
      }
    }
  }
}
export default seed

// TODO: Move elsewhere once we're not running babel-node src/seeds directly
// from package.json
;(async function () {
  try {
    await seed()
  } catch (e) {
    console.error(e)
  }
  process.exit()
})()
