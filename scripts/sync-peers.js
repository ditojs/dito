// Keeps the `peerDependencies` of the listed packages in sync with their
// mirrored `devDependencies`, so `pnpm update` also moves the peer ranges.
// Use `--check` to only report out-of-sync ranges and exit with an error.
//
// Which packages are peers: the listed packages aren't run from their own
// folders, the app's bundler builds them, from `src` in development and from
// `dist`, whose imports stay external. Every package that their code imports
// at runtime therefore has to resolve from the app, also with pnpm's isolated
// linker, so it is declared as a peer, and mirrored in `devDependencies` for
// building and testing here. Packages that are only imported by the type
// definitions in `types/`, e.g. `type-fest`, are regular `dependencies`:
// TypeScript resolves them from the package itself, and bundlers never see
// them. Packages that run in Node, e.g. `@ditojs/server`, use regular
// `dependencies` throughout.

import fs from 'node:fs'
import path from 'node:path'

const packages = ['packages/admin', 'packages/ui']

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
