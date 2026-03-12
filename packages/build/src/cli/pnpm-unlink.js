#!/usr/bin/env node

import { execSync } from 'node:child_process'
import { link, listLinks, unlink } from '../pnpm-linking.js'

const names = process.argv.slice(2)
const links = listLinks()

// Determine which repos to unlink and which to keep.
const toUnlink =
  names.length > 0
    ? links.filter(link => names.includes(link))
    : links
const toKeep = links.filter(link => !toUnlink.includes(link))

// Remove linked symlinks so pnpm install can restore them.
unlink(toUnlink)

// Restore node_modules from the unchanged lockfile.
execSync('pnpm install --frozen-lockfile', { stdio: 'inherit' })

// Re-link repos that weren't specified for unlinking.
if (toKeep.length > 0) {
  link(toKeep)
}
