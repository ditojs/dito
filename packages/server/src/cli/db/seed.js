import path from 'path'
import fs from 'fs-extra'
import chalk from 'chalk'
import { isFunction, isArray } from '@/utils'

export async function seed(app) {
  const seedDir = path.join(process.cwd(), 'seeds')
  const files = await fs.readdir(seedDir)
  let total = 0
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
          const res = await modelClass.query().insertGraph(seed)
          if (isArray(res)) {
            total += res.length
          }
        }
      }
    }
  }
  return chalk.green(`Seed: ${total} seed records created`)
}
