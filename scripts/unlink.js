import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'

const isEmpty = obj => obj == null || Object.keys(obj).length === 0

const names = process.argv.slice(2)
if (names.length === 0) {
  console.error('Usage: node scripts/unlink.js <package> ...')
  process.exit(1)
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))

for (const name of names) {
  delete pkg.dependencies?.[name]
  delete pkg.pnpm?.overrides?.[name]
}

if (isEmpty(pkg.dependencies)) {
  delete pkg.dependencies
}
if (pkg.pnpm && isEmpty(pkg.pnpm.overrides)) {
  delete pkg.pnpm.overrides
}
if (isEmpty(pkg.pnpm)) {
  delete pkg.pnpm
}

writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')

execSync('pnpm install', { stdio: 'inherit' })
