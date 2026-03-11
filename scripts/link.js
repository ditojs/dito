import { execSync } from 'child_process'

const names = process.argv.slice(2)
if (names.length === 0) {
  console.error('Usage: node scripts/link.js <package> ...')
  process.exit(1)
}

const paths = names.map(name => `../${name}`).join(' ')
execSync(`pnpm link ${paths}`, { stdio: 'inherit' })
