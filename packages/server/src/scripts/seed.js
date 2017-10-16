import path from 'path'
import fs from 'fs-extra'
import { isFunction } from '../utils'
import app from '../app'

async function seed() {
  const seedDir = path.join(process.cwd(), 'seeds')
  const files = await fs.readdir(seedDir)
  for (const file of files) {
    const desc = path.parse(file)
    if (/^\.(js|json)$/.test(desc.ext)) {
      const object = await import(path.resolve(seedDir, file))
      const seed = object.default || object
      const model = app.models[desc.name]
      if (model) {
        await model.query().truncate()
        if (isFunction(seed)) {
          await seed(model, app.models)
        } else {
          await model.query().insertGraph(seed)
        }
      }
    }
  }
}

async function seedAndExit() {
  try {
    await seed()
  } catch (err) {
    console.error(err)
  }
  process.exit()
}

seedAndExit()
