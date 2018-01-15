import path from 'path'
import fs from 'fs-extra'
import chalk from 'chalk'
import { isFunction, isArray } from '@ditojs/utils'

export async function seed(app) {
  const seedDir = path.join(process.cwd(), 'seeds')
  const files = await fs.readdir(seedDir)
  for (const file of files) {
    const { name, ext, base } = path.parse(file)
    if (/^\.(js|json)$/.test(ext)) {
      const object = await import(path.resolve(seedDir, file))
      const seed = object.default || object
      let res
      if (isFunction(seed)) {
        res = await seed(app.models)
      } else {
        const modelClass = app.models[name]
        if (modelClass) {
          await modelClass.truncate()
          res = await modelClass.insertGraph(seed)
        }
      }
      if (isArray(res)) {
        console.log(chalk.green(
          `${base}: ${res.length} seed records created.`))
      } else {
        console.log(chalk.red(
          `${base}: No seed records created.`))
      }
    }
  }
  return true // done
}
