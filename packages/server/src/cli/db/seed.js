import path from 'path'
import fs from 'fs-extra'
import chalk from 'chalk'
import util from 'util'
import pluralize from 'pluralize'
import { isFunction, isArray, camelize } from '@ditojs/utils'

export async function seed(app) {
  const seedDir = path.join(process.cwd(), 'seeds')
  const files = await fs.readdir(seedDir)
  const seedModels = []
  const seedFunctions = []
  // Create a lookup table with sort indices per model name.
  const modelIndices = Object.keys(app.models).reduce(
    (indices, name, index) => {
      indices[name] = index
      return indices
    },
    {}
  )
  // Collect all seed, and separate between seed functions and model see data:
  for (const file of files) {
    const { name, ext, base } = path.parse(file)
    if (/^\.(js|json)$/.test(ext)) {
      const object = await import(path.resolve(seedDir, file))
      const seed = object.default || object
      if (isFunction(seed)) {
        seedFunctions.push({
          base,
          seed
        })
      } else {
        const modelClass =
          app.models[name] ||
          app.models[camelize(pluralize.singular(name), true)]
        if (modelClass) {
          seedModels.push({
            base,
            seed,
            modelClass,
            index: modelIndices[modelClass.name]
          })
        }
      }
    }
  }
  // Now sort the seed model data according to `app.models` sorting,
  // as determined by `Application.sortModels()`:
  seedModels.sort((entry1, entry2) => entry1.index - entry2.index)
  for (const { base, seed, modelClass } of seedModels) {
    await handleSeed(app, base, seed, modelClass)
  }
  for (const { base, seed } of seedFunctions) {
    await handleSeed(app, base, seed)
  }
  return true // done
}

async function handleSeed(app, base, seed, modelClass) {
  try {
    let res
    if (isFunction(seed)) {
      res = await seed(app.models)
    } else if (modelClass) {
      await modelClass.truncate({ cascade: true })
      res = await modelClass.insertGraph(seed)
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
