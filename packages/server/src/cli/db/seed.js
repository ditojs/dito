import path from 'path'
import fs from 'fs-extra'
import chalk from 'chalk'
import util from 'util'
import pluralize from 'pluralize'
import { isFunction, isArray, camelize } from '@ditojs/utils'

export async function seed(app) {
  const seedDir = path.join(process.cwd(), 'seeds')
  const files = await fs.readdir(seedDir)
  for (const file of files) {
    const { name, ext, base } = path.parse(file)
    if (/^\.(js|json)$/.test(ext)) {
      try {
        const object = await import(path.resolve(seedDir, file))
        const seed = object.default || object
        let res
        if (isFunction(seed)) {
          res = await seed(app.models)
        } else {
          const modelClass =
            app.models[name] ||
            app.models[camelize(pluralize.singular(name), true)]
          if (modelClass) {
            await modelClass.truncate()
            res = await modelClass.insertGraph(seed)
          }
        }
        if (isArray(res)) {
          console.log(
            chalk.green(`${base}:`),
            chalk.cyan(`${res.length} seed records created.`)
          )
        } else {
          console.log(
            chalk.red(`${base}:`),
            chalk.cyan('No seed records created.')
          )
        }
      } catch (err) {
        console.error(
          chalk.red(`${base}:`),
          util.inspect(err, {
            colors: true,
            depth: null,
            maxArrayLength: null
          })
        )
      }
    }
  }
  return true // done
}
