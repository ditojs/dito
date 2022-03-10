#!/usr/bin/env node

import path from 'path'
import minimist from 'minimist'
import { getDataUri } from '@ditojs/build'

const argv = minimist(process.argv.slice(2), {
  string: 'template'
})
const assets = argv._.map(asset => {
  const file = path.resolve(asset)
  const { name } = path.parse(file)
  const data = getDataUri(file)
  const url = `url("${data}")`
  return { file, name, data, url }
})
let out = null
if (argv.template) {
  const { default: render } = await import(path.resolve(argv.template))
  out = render(assets)
} else {
  // Print out JSON data, but remove generated `url` properties.
  const filtered = assets.map(({ name, data }) => ({ name, data }))
  out = JSON.stringify(filtered, null, 2)
}
process.stdout.write(out)
