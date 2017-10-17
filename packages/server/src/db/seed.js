import path from 'path'
import fs from 'fs-extra'
import { isFunction } from '../utils'

export async function seed(app) {
  const seedDir = path.join(process.cwd(), 'seeds')
  const files = await fs.readdir(seedDir)
  for (const file of files) {
    const desc = path.parse(file)
    if (/^\.(js|json)$/.test(desc.ext)) {
      const object = await import(path.resolve(seedDir, file))
      const seed = object.default || object
      const modelClass = app.models[desc.name]
      if (modelClass) {
        await modelClass.query().truncate()
        if (isFunction(seed)) {
          await seed(modelClass, app.models)
        } else {
          await modelClass.query().insertGraph(seed)
        }
      }
    }
  }
}
