import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const names = process.argv.slice(2)
if (names.length === 0) {
  console.error('Usage: node scripts/link.js <package> ...')
  process.exit(1)
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
pkg.dependencies ??= {}
pkg.pnpm ??= {}
pkg.pnpm.overrides ??= {}

for (const name of names) {
  const pkgJson = JSON.parse(
    readFileSync(resolve('..', name, 'package.json'), 'utf8')
  )
  const linkPath = `link:../${name}`
  pkg.dependencies[pkgJson.name] = linkPath
  pkg.pnpm.overrides[pkgJson.name] = linkPath
}

writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')

execSync('pnpm install', { stdio: 'inherit' })
