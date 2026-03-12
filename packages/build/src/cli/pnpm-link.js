#!/usr/bin/env node

import { link } from '../pnpm-linking.js'

const names = process.argv.slice(2)
if (names.length === 0) {
  console.error('Usage: pnpm-link <repo> ...')
  process.exit(1)
}

link(names)
