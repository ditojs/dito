import path from 'path'
import fs from 'fs-extra'
import App from '../core/App'
import { isFunction } from '../utils'
import config from '../config'
import models from '../models'

const app = new App(config, models)

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
          await seed(model, models)
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
