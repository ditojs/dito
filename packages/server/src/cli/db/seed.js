import path from 'path'
import fs from 'fs-extra'
import pico from 'picocolors'
import util from 'util'
import pluralize from 'pluralize'
import { isFunction, isArray, camelize } from '@ditojs/utils'

export async function seed(app) {
  const seedDir = path.join(process.cwd(), 'seeds')
  const files = await fs.readdir(seedDir)
  const seeds = []
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
    if (!name.startsWith('.') && ['.js', '.json'].includes(ext)) {
      const object = await import(path.resolve(seedDir, file))
      const seed = object.default || object
      // Try to determine the related model from the seed name, and use it also
      // to determine seed sequence based on its index in `app.models`.
      const modelClass =
        app.models[name] ||
        app.models[camelize(pluralize.singular(name), true)]
      const index = modelClass ? modelIndices[modelClass.name] : Infinity
      seeds.push({
        base,
        seed,
        modelClass,
        index
      })
    }
  }
  // Now sort the seed model data according to `app.models` sorting,
  // as determined by `Application.sortModels()`:
  seeds.sort((entry1, entry2) => entry1.index - entry2.index)
  for (const { base, seed, modelClass } of seeds) {
    await handleSeed(app, base, seed, modelClass)
  }
  return true
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
      console.info(
        pico.green(`${base}:`),
        pico.cyan(`${res.length} seed records created.`)
      )
    } else {
      console.info(
        pico.red(`${base}:`),
        pico.cyan('No seed records created.')
      )
    }
  } catch (err) {
    console.error(
      pico.red(`${base}:`),
      util.inspect(err, {
        colors: true,
        depth: null,
        maxArrayLength: null
      })
    )
  }
}
