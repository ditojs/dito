import path from 'path'
import fs from 'fs-extra'
import chalk from 'chalk'
import { isFunction, isArray } from '@/utils'

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
        const res = isFunction(seed)
          ? await seed(modelClass, app.models)
          : await modelClass.query().insertGraph(seed)
        if (isArray(res)) {
          console.log(chalk.green(
            `${modelClass.name}: ${res.length} seed records created.`))
        } else {
          console.log(chalk.red(
            `${modelClass.name}: No seed records created.`))
        }
      }
    }
  }
  return true // done
}
