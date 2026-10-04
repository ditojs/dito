// Keeps the `peerDependencies` of the listed packages in sync with their
// mirrored `devDependencies`, so `pnpm update` also moves the peer ranges.
// Use `--check` to only report out-of-sync ranges and exit with an error.

import fs from 'node:fs'
import path from 'node:path'

const packages = ['packages/admin']

const check = process.argv.includes('--check')
let outOfSync = 0

for (const dir of packages) {
  const file = path.join(dir, 'package.json')
  const json = JSON.parse(fs.readFileSync(file, 'utf8'))
  const { peerDependencies = {}, devDependencies = {} } = json
  let changed = false
  for (const [name, range] of Object.entries(peerDependencies)) {
    const devRange = devDependencies[name]
    if (!devRange) {
      console.error(`${file}: peer ${name} is missing in devDependencies`)
      outOfSync++
    } else if (range !== devRange) {
      console.info(`${file}: ${name} ${range} -> ${devRange}`)
      peerDependencies[name] = devRange
      changed = true
      outOfSync++
    }
  }
  if (changed && !check) {
    fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`)
  }
}

if (check && outOfSync > 0) {
  console.error('Run `pnpm run peers:sync` to sync peer dependencies.')
  process.exit(1)
}
