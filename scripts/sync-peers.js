// Keeps the `peerDependencies` of the listed packages in sync with their
// mirrored `devDependencies`, so `pnpm update` also moves the peer ranges.
// Use `--check` to only report out-of-sync ranges and exit with an error.
//
// Which packages are peers:
// - Admin and UI aren't run from their own folders, the app's bundler builds
//   them, from `src` in development and from `dist`, whose imports stay
//   external. Every package that their code imports at runtime therefore has
//   to resolve from the app, also with pnpm's isolated linker, so it is a peer,
//   as are the required peers of those packages that the app must also
//   provide, e.g. `@floating-ui/dom` for `@tiptap/vue-3`.
// - The server uses regular `dependencies`, except for the packages whose
//   instances it has to share with the app, `knex` and `objection`, and the
//   ones only some apps need, e.g. the AWS SDK of its S3 storage.
// - Peers are mirrored in `devDependencies` for building and testing here,
//   except optional peers, which keep the range their code needs, so apps that
//   don't use them aren't pushed to the versions tested here.
// - Packages that are only imported by the type definitions in `types/`, e.g.
//   `type-fest`, are regular `dependencies`: TypeScript resolves them from the
//   package itself, and bundlers never see them.

import fs from 'node:fs'
import path from 'node:path'

const packages = ['packages/admin', 'packages/ui', 'packages/server']

const check = process.argv.includes('--check')
let outOfSync = 0

for (const dir of packages) {
  const file = path.join(dir, 'package.json')
  const json = JSON.parse(fs.readFileSync(file, 'utf8'))
  const {
    peerDependencies = {},
    peerDependenciesMeta = {},
    devDependencies = {}
  } = json
  let changed = false
  for (const [name, range] of Object.entries(peerDependencies)) {
    // Optional peers keep the range that their code needs, as apps that don't
    // use them shouldn't be pushed to the versions tested here:
    if (peerDependenciesMeta[name]?.optional) continue
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
